// Provider webhooks. Currently: inbound SMS from Twilio, used to honor STOP
// opt-outs and to record replies against the lead's timeline.
//
// NOTE: For production, validate the `X-Twilio-Signature` header against your
// auth token before trusting the payload. Opt-out handling is fail-safe (the
// worst case of a spoofed STOP is that a lead stops being contacted), so this
// MVP records the opt-out without signature validation; add it before exposing
// inbound reply storage to untrusted callers.
import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error';
import { isOptOutMessage } from '../utils/compliance';
import { normalizePhone } from '../utils/csv';
import { audit } from '../services/audit';
import { logger } from '../lib/logger';

const router = Router();

function twiml(res: import('express').Response, body = '') {
  res.type('text/xml').send(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`);
}

// Find the lead a phone number belongs to. Phones are stored formatted, so we
// narrow by the last 4 digits then compare on normalized digits.
async function findLeadByPhone(from: string) {
  const digits = normalizePhone(from);
  if (!digits) return null;
  const candidates = await prisma.lead.findMany({ where: { phone: { contains: digits.slice(-4) } } });
  return candidates.find((l) => normalizePhone(l.phone) === digits) ?? null;
}

router.post(
  '/twilio/sms',
  asyncHandler(async (req, res) => {
    const from = String(req.body?.From ?? '');
    const body = String(req.body?.Body ?? '');
    const lead = await findLeadByPhone(from);

    if (!lead) {
      logger.warn('inbound SMS from unknown number', { from });
      return twiml(res);
    }

    if (isOptOutMessage(body)) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: { unsubscribed: true, consentSms: false, score: 'DEAD', scoreReason: 'Opted out via SMS (STOP).' },
      });
      await prisma.consent.create({ data: { leadId: lead.id, channel: 'SMS', granted: false, source: 'sms_stop' } });
      await audit({ action: 'lead.unsubscribed', entity: 'Lead', entityId: lead.id, metadata: { via: 'sms_stop' } });
      logger.info('lead opted out via SMS', { leadId: lead.id });
      return twiml(res, '<Message>You have been unsubscribed and will no longer receive texts.</Message>');
    }

    // Record the reply on the timeline and surface that the lead is engaging.
    await prisma.message.create({
      data: {
        companyId: lead.companyId,
        leadId: lead.id,
        type: 'SMS',
        direction: 'INBOUND',
        status: 'RECEIVED',
        content: body,
      },
    });
    if (lead.status === 'NEW' || lead.status === 'CONTACTED') {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: 'RESPONDING' } });
    }
    twiml(res);
  })
);

export default router;
