// Seed script: an admin operator, one demo roofing client, sample leads,
// built-in templates, and a couple of drafted messages in the approval queue.
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { BUILT_IN_TEMPLATES } from '../src/utils/templates';
import { scoreLead } from '../src/utils/scoring';

const prisma = new PrismaClient();

async function main() {
  const adminPass = await bcrypt.hash('admin1234', 10);
  const clientPass = await bcrypt.hash('client1234', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@leakhunter.app' },
    update: {},
    create: { email: 'admin@leakhunter.app', passwordHash: adminPass, name: 'LeakHunter Operator', role: 'ADMIN', emailVerified: true },
  });

  const company = await prisma.company.upsert({
    where: { id: 'demo-company' },
    update: {},
    create: {
      id: 'demo-company',
      name: 'Garden State Roofing',
      address: '123 Main St, Newark, NJ',
      serviceArea: 'Essex & Union County, NJ',
      phone: '(973) 555-0100',
      email: 'office@gsroofing.example',
      website: 'https://gsroofing.example',
    },
  });

  await prisma.onboarding.upsert({
    where: { companyId: company.id },
    update: {},
    create: { companyId: company.id, step: 7, completed: true },
  });

  await prisma.user.upsert({
    where: { email: 'owner@gsroofing.example' },
    update: {},
    create: { email: 'owner@gsroofing.example', passwordHash: clientPass, name: 'Sam Rivera', role: 'CLIENT', companyId: company.id, emailVerified: true },
  });

  // Templates
  const existingTemplates = await prisma.template.count({ where: { companyId: company.id } });
  if (existingTemplates === 0) {
    await prisma.template.createMany({
      data: BUILT_IN_TEMPLATES.map((t) => ({
        companyId: company.id,
        name: `${t.workflow} (${t.type})`,
        type: t.type,
        subject: t.subject,
        body: t.body,
        workflow: t.workflow,
      })),
    });
  }

  // Sample leads spanning the score spectrum.
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const sampleLeads = [
    { name: 'Maria Lopez', phone: '(908) 555-0001', email: 'maria@example.com', source: 'missed_call', createdAt: new Date(now - 2 * day), estimatedValue: 12000, status: 'NEW', consentSms: true, consentEmail: true },
    { name: 'John Carter', phone: '(973) 555-0002', email: 'john@example.com', source: 'web_form', createdAt: new Date(now - 10 * day), estimatedValue: 8500, status: 'CONTACTED', consentEmail: true },
    { name: 'Aisha Patel', phone: '(201) 555-0003', email: 'aisha@example.com', source: 'old_quote', createdAt: new Date(now - 45 * day), estimatedValue: 15000, status: 'ESTIMATE', consentEmail: true, consentSms: true },
    { name: 'Greg Nolan', phone: '(908) 555-0004', email: 'greg@example.com', source: 'csv_import', createdAt: new Date(now - 120 * day), estimatedValue: 6000, status: 'NEW' },
    { name: 'Tina Brooks', phone: '(862) 555-0005', email: 'tina@example.com', source: 'referral', createdAt: new Date(now - 4 * day), estimatedValue: 9000, status: 'RESPONDING', consentEmail: true, consentSms: true },
    { name: 'Opted Out Owen', phone: '(973) 555-0006', email: 'owen@example.com', source: 'csv_import', createdAt: new Date(now - 30 * day), estimatedValue: 5000, status: 'NEW', unsubscribed: true },
  ];

  for (const l of sampleLeads) {
    const s = scoreLead({ source: l.source, status: l.status, estimatedValue: l.estimatedValue, createdAt: l.createdAt, unsubscribed: l.unsubscribed });
    const existing = await prisma.lead.findFirst({ where: { companyId: company.id, email: l.email } });
    if (existing) continue;
    await prisma.lead.create({
      data: {
        companyId: company.id,
        name: l.name,
        phone: l.phone,
        email: l.email,
        source: l.source,
        status: l.status as never,
        estimatedValue: l.estimatedValue,
        consentEmail: !!l.consentEmail,
        consentSms: !!l.consentSms,
        unsubscribed: !!l.unsubscribed,
        score: s.score,
        scoreReason: s.reason,
        pipeline: { create: { stage: l.status as never, value: l.estimatedValue } },
      },
    });
  }

  // A couple of drafts in the approval queue.
  const maria = await prisma.lead.findFirst({ where: { companyId: company.id, name: 'Maria Lopez' } });
  if (maria) {
    const hasDraft = await prisma.message.count({ where: { leadId: maria.id } });
    if (hasDraft === 0) {
      await prisma.message.create({
        data: {
          companyId: company.id,
          leadId: maria.id,
          type: 'SMS',
          status: 'PENDING_APPROVAL',
          content: 'Hi Maria, this is Garden State Roofing — sorry we missed your call! Were you reaching out about a roof repair? Reply STOP to opt out.',
          generatedBy: 'template',
        },
      });
    }
  }

  await prisma.featureFlag.upsert({
    where: { key: 'auto_send' },
    update: {},
    create: { key: 'auto_send', enabled: false, description: 'Global kill-switch for any automated sending' },
  });

  console.log('Seed complete.');
  console.log('  Admin login:  admin@leakhunter.app / admin1234');
  console.log('  Client login: owner@gsroofing.example / client1234');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
