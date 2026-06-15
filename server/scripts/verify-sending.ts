/* One-shot verification of the live-send kill-switch and the STOP webhook.
   Runs the real Express app in-process via supertest (no listening server). */
import 'dotenv/config';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';

const app = createApp();

async function main() {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@leakhunter.app', password: 'admin1234' });
  const token = login.body.token as string;
  const auth = (r: request.Test) => r.set('Authorization', `Bearer ${token}`);

  const leads = await auth(request(app).get('/api/leads?companyId=demo-company&q=Aisha'));
  const aisha = leads.body.leads[0];
  console.log('provider(email):', process.env.EMAIL_PROVIDER);

  const draft = await auth(request(app).post(`/api/leads/${aisha.id}/draft`).send({ type: 'EMAIL' }));
  const mid = draft.body.message.id as string;

  const gated = await auth(request(app).post(`/api/messages/${mid}/approve`).send({ sendNow: true }));
  console.log(`1) send with kill-switch OFF -> HTTP ${gated.status}: ${gated.body.error}`);

  await auth(request(app).put('/api/admin/flags/live_sending').send({ enabled: true }));
  await auth(request(app).put('/api/admin/flags/email_sending').send({ enabled: true }));

  const opened = await auth(request(app).post(`/api/messages/${mid}/send`));
  const m = opened.body.message ?? {};
  console.log(`2) send with flags ON  -> status ${m.status} (gate passed; ${(m.failureReason || 'sent').slice(0, 50)})`);

  // STOP webhook for Maria's number
  const maria0 = await auth(request(app).get('/api/leads?companyId=demo-company&q=Maria'));
  const phone = maria0.body.leads[0].phone;
  const stop = await request(app)
    .post('/api/webhooks/twilio/sms')
    .type('form')
    .send({ From: '+19085550001', Body: 'STOP', MessageSid: 'SM1' });
  console.log(`3) STOP webhook -> HTTP ${stop.status}, body includes "unsubscribed": ${stop.text.includes('unsubscribed')}`);
  const maria1 = await auth(request(app).get('/api/leads?companyId=demo-company&q=Maria'));
  const ma = maria1.body.leads[0];
  console.log(`   Maria (${phone}) now: unsubscribed=${ma.unsubscribed} score=${ma.score} consentSms=${ma.consentSms}`);

  // reset the flags we toggled so the DB returns to gated default
  await auth(request(app).put('/api/admin/flags/live_sending').send({ enabled: false }));
  await auth(request(app).put('/api/admin/flags/email_sending').send({ enabled: false }));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
