import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, scopedCompanyId } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { parseLeadsCsv, dedupeKey, normalizePhone, normalizeEmail } from '../utils/csv';
import { scoreLead } from '../utils/scoring';
import { classifyAndSave, generateDraft } from '../services/recovery';
import { getAiProvider } from '../services/ai';
import { audit } from '../services/audit';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authenticate);

function requireCompany(req: import('express').Request): string {
  const companyId = scopedCompanyId(req, (req.query.companyId as string) || (req.body?.companyId as string));
  if (!companyId) throw new HttpError(400, 'No company in scope. Create a company first.');
  return companyId;
}

// Verify the caller is allowed to act on a given lead. Admins may touch any
// lead; everyone else is pinned to their own company. Throws 404/403.
async function assertLeadScope(req: import('express').Request, leadId: string): Promise<void> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { companyId: true } });
  if (!lead) throw new HttpError(404, 'Lead not found');
  if (req.user!.role !== 'ADMIN' && lead.companyId !== req.user!.companyId) {
    throw new HttpError(403, 'Not permitted');
  }
}

// List with search + filter.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = requireCompany(req);
    const { q, status, score, tag } = req.query as Record<string, string>;
    const where: Prisma.LeadWhereInput = { companyId };
    if (status) where.status = status as Prisma.LeadWhereInput['status'];
    if (score) where.score = score as Prisma.LeadWhereInput['score'];
    if (tag) where.tags = { has: tag };
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q } },
      ];
    }
    const leads = await prisma.lead.findMany({
      where,
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
    res.json({ leads });
  })
);

const createSchema = z.object({
  companyId: z.string().optional(),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  source: z.string().optional(),
  estimatedValue: z.number().int().nonnegative().optional(),
  notesText: z.string().optional(),
  tags: z.array(z.string()).optional(),
  consentEmail: z.boolean().optional(),
  consentSms: z.boolean().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = requireCompany(req);
    const data = createSchema.parse(req.body);

    // Dedupe by normalized phone/email within company. We compare using the
    // same dedupeKey logic as CSV import so formatting differences
    // ("(908) 555-1234" vs "908-555-1234") still collide.
    const key = dedupeKey(data);
    if (normalizePhone(data.phone) || normalizeEmail(data.email || undefined)) {
      const existing = await prisma.lead.findMany({
        where: { companyId },
        select: { phone: true, email: true, name: true },
      });
      if (existing.some((e) => dedupeKey(e) === key)) {
        throw new HttpError(409, 'A lead with that phone/email already exists');
      }
    }

    const score = scoreLead({
      source: data.source,
      status: 'NEW',
      estimatedValue: data.estimatedValue ?? 0,
      createdAt: new Date(),
    });

    const lead = await prisma.lead.create({
      data: {
        companyId,
        name: data.name,
        phone: data.phone,
        email: data.email || null,
        source: data.source ?? 'manual',
        estimatedValue: data.estimatedValue ?? 0,
        notesText: data.notesText,
        tags: data.tags ?? [],
        consentEmail: data.consentEmail ?? false,
        consentSms: data.consentSms ?? false,
        score: score.score,
        scoreReason: score.reason,
        pipeline: { create: { stage: 'NEW', value: data.estimatedValue ?? 0 } },
      },
    });
    await audit({ actorId: req.user!.id, action: 'lead.created', entity: 'Lead', entityId: lead.id });
    res.status(201).json({ lead });
  })
);

// Timeline view: lead + notes + messages + tasks chronologically.
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        notes: { orderBy: { createdAt: 'desc' } },
        messages: { orderBy: { createdAt: 'desc' } },
        tasks: { orderBy: { createdAt: 'desc' } },
        pipeline: true,
        company: { select: { name: true } },
      },
    });
    if (!lead) throw new HttpError(404, 'Lead not found');
    if (req.user!.role !== 'ADMIN' && lead.companyId !== req.user!.companyId) {
      throw new HttpError(403, 'Not permitted');
    }
    res.json({ lead });
  })
);

const updateSchema = createSchema.partial().extend({
  status: z.enum(['NEW', 'CONTACTED', 'RESPONDING', 'ESTIMATE', 'BOOKED', 'CLOSED']).optional(),
  unsubscribed: z.boolean().optional(),
});

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const data = updateSchema.parse(req.body);
    let lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: {
        ...data,
        email: data.email === '' ? null : data.email,
      },
    });
    if (data.status) {
      await prisma.pipeline.updateMany({ where: { leadId: lead.id }, data: { stage: data.status } });
    }
    // Keep the score in sync when fields that drive it change (status, value,
    // consent/unsubscribe). Otherwise a CLOSED/unsubscribed lead stays "HOT".
    const rescore = scoreLead({
      source: lead.source,
      status: lead.status,
      estimatedValue: lead.estimatedValue,
      createdAt: lead.createdAt,
      lastContactedAt: lead.lastContactedAt,
      unsubscribed: lead.unsubscribed,
      notesText: lead.notesText,
    });
    if (rescore.score !== lead.score) {
      lead = await prisma.lead.update({
        where: { id: lead.id },
        data: { score: rescore.score, scoreReason: rescore.reason },
      });
    }
    await audit({ actorId: req.user!.id, action: 'lead.updated', entity: 'Lead', entityId: lead.id, metadata: data });
    res.json({ lead });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    await prisma.lead.delete({ where: { id: req.params.id } });
    await audit({ actorId: req.user!.id, action: 'lead.deleted', entity: 'Lead', entityId: req.params.id });
    res.json({ ok: true });
  })
);

// CSV import with dedupe against existing leads.
router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const companyId = requireCompany(req);
    const csv = req.file ? req.file.buffer.toString('utf-8') : (req.body?.csv as string);
    if (!csv) throw new HttpError(400, 'Provide a CSV file or a "csv" body field');

    const { leads: parsed, errors, duplicatesInFile } = parseLeadsCsv(csv);

    // Load existing dedupe keys.
    const existing = await prisma.lead.findMany({
      where: { companyId },
      select: { phone: true, email: true, name: true },
    });
    const existingKeys = new Set(existing.map((e) => dedupeKey(e)));

    let imported = 0;
    let skipped = 0;
    for (const p of parsed) {
      const key = dedupeKey(p);
      if (key && existingKeys.has(key)) {
        skipped++;
        continue;
      }
      const score = scoreLead({
        source: p.source ?? 'csv_import',
        status: 'NEW',
        estimatedValue: p.estimatedValue ?? 0,
        createdAt: new Date(),
      });
      await prisma.lead.create({
        data: {
          companyId,
          name: p.name,
          phone: p.phone,
          email: p.email ?? null,
          source: p.source ?? 'csv_import',
          estimatedValue: p.estimatedValue ?? 0,
          notesText: p.notesText,
          score: score.score,
          scoreReason: score.reason,
          pipeline: { create: { stage: 'NEW', value: p.estimatedValue ?? 0 } },
        },
      });
      if (key) existingKeys.add(key);
      imported++;
    }

    await audit({
      actorId: req.user!.id,
      action: 'lead.import',
      entity: 'Company',
      entityId: companyId,
      metadata: { imported, skipped, duplicatesInFile },
    });
    res.json({ imported, skipped, duplicatesInFile, parseErrors: errors });
  })
);

// Re-classify a single lead (AI/rule based).
router.post(
  '/:id/classify',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const lead = await classifyAndSave(req.params.id);
    res.json({ lead });
  })
);

// Generate a follow-up draft -> approval queue.
const draftSchema = z.object({
  type: z.enum(['EMAIL', 'SMS']),
  workflow: z.enum(['missed_call', 're_engage', 'estimate_followup']).optional(),
  style: z.enum(['recovery', 'sales']).optional(),
});
router.post(
  '/:id/draft',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const { type, workflow, style } = draftSchema.parse(req.body);
    // Operators (admins) pitch roofing companies, so default their drafts to the
    // sales templates; clients get the roofer→homeowner recovery copy.
    const resolvedStyle = style ?? (req.user!.role === 'ADMIN' ? 'sales' : 'recovery');
    const message = await generateDraft({
      leadId: req.params.id,
      type,
      workflow,
      style: resolvedStyle,
      actorId: req.user!.id,
    });
    res.status(201).json({ message });
  })
);

// AI next-best-action + history summary for a lead.
router.get(
  '/:id/insights',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: { messages: { orderBy: { createdAt: 'desc' }, take: 5, select: { content: true } } },
    });
    if (!lead) throw new HttpError(404, 'Lead not found');
    const ai = getAiProvider();
    const [summary, action] = await Promise.all([
      ai.summarizeHistory(lead.messages.map((m) => m.content)),
      ai.nextBestAction({
        name: lead.name,
        source: lead.source,
        status: lead.status,
        estimatedValue: lead.estimatedValue,
        createdAt: lead.createdAt,
        lastContactedAt: lead.lastContactedAt,
        unsubscribed: lead.unsubscribed,
      }),
    ]);
    res.json({ summary, nextBestAction: action, score: lead.score, scoreReason: lead.scoreReason });
  })
);

// --- Notes & tasks --------------------------------------------------------
router.post(
  '/:id/notes',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const text = z.object({ text: z.string().min(1) }).parse(req.body).text;
    const note = await prisma.note.create({
      data: { leadId: req.params.id, text, createdById: req.user!.id },
    });
    res.status(201).json({ note });
  })
);

router.post(
  '/:id/tasks',
  asyncHandler(async (req, res) => {
    await assertLeadScope(req, req.params.id);
    const body = z
      .object({ title: z.string().min(1), description: z.string().optional(), dueDate: z.string().optional() })
      .parse(req.body);
    const task = await prisma.task.create({
      data: {
        leadId: req.params.id,
        ownerId: req.user!.id,
        title: body.title,
        description: body.description,
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
      },
    });
    res.status(201).json({ task });
  })
);

export default router;
