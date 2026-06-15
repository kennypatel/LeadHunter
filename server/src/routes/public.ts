// Public, unauthenticated endpoints: marketing lead capture, the ROI calculator,
// and compliance (unsubscribe). These power the public marketing site.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { asyncHandler } from '../middleware/error';
import { calculatorEstimate } from '../utils/roi';
import { audit } from '../services/audit';
import { logger } from '../lib/logger';

const router = Router();

const captureLimiter = rateLimit({ windowMs: 60 * 1000, max: 10 });

// Marketing site "Get Your Free Audit" / contact form.
const captureSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  message: z.string().optional(),
  source: z.string().optional(),
});

router.post(
  '/leads',
  captureLimiter,
  asyncHandler(async (req, res) => {
    const data = captureSchema.parse(req.body);
    if (!data.email && !data.phone) {
      return res.status(400).json({ error: 'Provide an email or phone so we can reach you.' });
    }
    const inbound = await prisma.inboundLead.create({
      data: {
        name: data.name,
        email: data.email || null,
        phone: data.phone,
        message: data.message,
        source: data.source || 'website',
      },
    });
    await audit({ action: 'inbound_lead.created', entity: 'InboundLead', entityId: inbound.id });
    logger.info('inbound lead captured', { id: inbound.id });
    res.status(201).json({ ok: true, message: "Thanks! We'll reach out shortly." });
  })
);

// Public ROI calculator for the landing page.
const calcSchema = z.object({
  monthlyLeads: z.number().nonnegative(),
  missedPct: z.number().min(0).max(100),
  avgJobValue: z.number().nonnegative(),
  closeRate: z.number().min(0).max(1).optional(),
});
router.post('/roi-calculator', (req, res) => {
  const input = calcSchema.parse(req.body);
  res.json({ estimate: calculatorEstimate(input) });
});

// Unsubscribe by token (lead id) — compliance.
router.get(
  '/unsubscribe',
  asyncHandler(async (req, res) => {
    const leadId = String(req.query.lead ?? '');
    if (!leadId) return res.status(400).json({ error: 'Missing lead token' });
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (lead) {
      await prisma.lead.update({
        where: { id: leadId },
        data: { unsubscribed: true, consentEmail: false, consentSms: false, score: 'DEAD' },
      });
      await prisma.consent.create({ data: { leadId, channel: 'EMAIL', granted: false, source: 'unsubscribe_link' } });
      await audit({ action: 'lead.unsubscribed', entity: 'Lead', entityId: leadId });
    }
    res.json({ ok: true, message: 'You have been unsubscribed and will no longer be contacted.' });
  })
);

router.post(
  '/unsubscribe',
  asyncHandler(async (req, res) => {
    // Accept the lead id from the body (form) OR the query string. Mailbox
    // providers performing RFC 8058 one-click unsubscribe POST to the header
    // URL (which carries ?lead=) with a non-JSON body, so we must not require it.
    const lead = String((req.body?.lead as string) || (req.query.lead as string) || '');
    const channel = (req.body?.channel as string) || undefined;
    if (!lead) return res.status(400).json({ error: 'Missing lead token' });
    const exists = await prisma.lead.findUnique({ where: { id: lead } });
    if (exists) {
      await prisma.lead.update({
        where: { id: lead },
        data: { unsubscribed: true, consentEmail: false, consentSms: false, score: 'DEAD' },
      });
      await prisma.consent.create({
        data: { leadId: lead, channel: channel === 'SMS' ? 'SMS' : 'EMAIL', granted: false, source: 'unsubscribe_one_click' },
      });
      await audit({ action: 'lead.unsubscribed', entity: 'Lead', entityId: lead, metadata: { via: 'list_unsubscribe' } });
    }
    res.json({ ok: true });
  })
);

export default router;
