import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';
import { processDueMessages } from '../services/messaging';
import { audit } from '../services/audit';

const router = Router();
router.use(authenticate, requireRole('ADMIN'));

// Audit log viewer.
router.get(
  '/audit',
  asyncHandler(async (req, res) => {
    const { entity, entityId } = req.query as Record<string, string>;
    const logs = await prisma.auditLog.findMany({
      where: { entity: entity || undefined, entityId: entityId || undefined },
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { actor: { select: { email: true, name: true } } },
    });
    res.json({ logs });
  })
);

// Failed jobs / retry.
router.get(
  '/failed-messages',
  asyncHandler(async (_req, res) => {
    const messages = await prisma.message.findMany({
      where: { status: 'FAILED' },
      orderBy: { updatedAt: 'desc' },
      include: { lead: { select: { name: true } } },
    });
    res.json({ messages });
  })
);

router.post(
  '/retry-due',
  asyncHandler(async (_req, res) => {
    const result = await processDueMessages();
    res.json(result);
  })
);

// Bulk data action: permanently clear the stored phone number on every lead.
router.post(
  '/clear-phone-numbers',
  asyncHandler(async (req, res) => {
    const result = await prisma.lead.updateMany({
      where: { phone: { not: null } },
      data: { phone: null },
    });
    await audit({
      actorId: req.user!.id,
      action: 'lead.phones_cleared',
      entity: 'Lead',
      metadata: { count: result.count },
    });
    res.json({ cleared: result.count });
  })
);

// Users CRUD (minimal).
router.get(
  '/users',
  asyncHandler(async (_req, res) => {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, name: true, role: true, companyId: true, createdAt: true, lastLoginAt: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ users });
  })
);

router.patch(
  '/users/:id',
  asyncHandler(async (req, res) => {
    const body = z.object({ role: z.enum(['ADMIN', 'CLIENT', 'VIEWER']).optional(), companyId: z.string().nullable().optional() }).parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: body,
      select: { id: true, email: true, role: true, companyId: true },
    });
    res.json({ user });
  })
);

// Feature flags.
router.get(
  '/flags',
  asyncHandler(async (_req, res) => {
    const flags = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
    res.json({ flags });
  })
);

router.put(
  '/flags/:key',
  asyncHandler(async (req, res) => {
    const body = z.object({ enabled: z.boolean(), description: z.string().optional() }).parse(req.body);
    const flag = await prisma.featureFlag.upsert({
      where: { key: req.params.key },
      update: body,
      create: { key: req.params.key, ...body },
    });
    res.json({ flag });
  })
);

// JSON data export.
router.get(
  '/export.json',
  asyncHandler(async (req, res) => {
    const companyId = req.query.companyId as string | undefined;
    const where = companyId ? { companyId } : {};
    const [companies, leads, messages] = await Promise.all([
      prisma.company.findMany({ where: companyId ? { id: companyId } : {} }),
      prisma.lead.findMany({ where }),
      prisma.message.findMany({ where }),
    ]);
    res.json({ exportedAt: new Date(), companies, leads, messages });
  })
);

export default router;
