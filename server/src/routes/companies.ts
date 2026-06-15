import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, scopedCompanyId, signToken } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import { env } from '../config/env';
import { audit } from '../services/audit';
import { BUILT_IN_TEMPLATES } from '../utils/templates';

const router = Router();
router.use(authenticate);

// Non-admins may only act on their own company. Throws 403 otherwise.
function assertCompanyScope(req: import('express').Request, companyId: string): void {
  if (req.user!.role !== 'ADMIN' && req.user!.companyId !== companyId) {
    throw new HttpError(403, 'Not permitted');
  }
}

// Admin: list all companies. Client: their own.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    if (req.user!.role === 'ADMIN') {
      const companies = await prisma.company.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { leads: true, users: true } } },
      });
      return res.json({ companies });
    }
    const company = req.user!.companyId
      ? await prisma.company.findUnique({ where: { id: req.user!.companyId } })
      : null;
    res.json({ companies: company ? [company] : [] });
  })
);

const companySchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  serviceArea: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().optional(),
});

// Create a company and seed it with the built-in templates + onboarding.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const data = companySchema.parse(req.body);
    const company = await prisma.company.create({
      data: { ...data, email: data.email || null },
    });
    await prisma.onboarding.create({ data: { companyId: company.id, step: 2 } });
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

    // Attach the creating user to this company if they have none (applies to a
    // solo operator/admin too). Issue a fresh token + cookie so the new
    // companyId takes effect immediately without re-logging-in.
    let token: string | undefined;
    if (!req.user!.companyId) {
      await prisma.user.update({ where: { id: req.user!.id }, data: { companyId: company.id } });
      const authUser = { id: req.user!.id, email: req.user!.email, role: req.user!.role, companyId: company.id };
      token = signToken(authUser);
      res.cookie(env.cookieName, token, {
        httpOnly: true,
        secure: env.isProd,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      });
    }
    await audit({ actorId: req.user!.id, action: 'company.created', entity: 'Company', entityId: company.id });
    res.status(201).json({ company, token });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const allowed = scopedCompanyId(req, req.params.id);
    if (req.user!.role !== 'ADMIN' && allowed !== req.params.id) throw new HttpError(403, 'Not permitted');
    const data = companySchema.partial().extend({ autoSendEnabled: z.boolean().optional() }).parse(req.body);
    const company = await prisma.company.update({
      where: { id: req.params.id },
      data: { ...data, email: data.email === '' ? null : data.email },
    });
    await audit({ actorId: req.user!.id, action: 'company.updated', entity: 'Company', entityId: company.id, metadata: data });
    res.json({ company });
  })
);

// Owners (contacts at the roofing company).
router.post(
  '/:id/owners',
  asyncHandler(async (req, res) => {
    assertCompanyScope(req, req.params.id);
    const body = z
      .object({ name: z.string().min(1), role: z.string().optional(), phone: z.string().optional(), email: z.string().optional() })
      .parse(req.body);
    const owner = await prisma.owner.create({ data: { ...body, companyId: req.params.id } });
    res.status(201).json({ owner });
  })
);

// Onboarding progress.
router.get(
  '/:id/onboarding',
  asyncHandler(async (req, res) => {
    assertCompanyScope(req, req.params.id);
    const onboarding = await prisma.onboarding.findUnique({ where: { companyId: req.params.id } });
    res.json({ onboarding });
  })
);

router.patch(
  '/:id/onboarding',
  asyncHandler(async (req, res) => {
    assertCompanyScope(req, req.params.id);
    const body = z.object({ step: z.number().int().min(1).max(7).optional(), completed: z.boolean().optional() }).parse(req.body);
    const onboarding = await prisma.onboarding.upsert({
      where: { companyId: req.params.id },
      update: body,
      create: { companyId: req.params.id, step: body.step ?? 1, completed: body.completed ?? false },
    });
    res.json({ onboarding });
  })
);

// Templates CRUD (scoped to company).
router.get(
  '/:id/templates',
  asyncHandler(async (req, res) => {
    assertCompanyScope(req, req.params.id);
    const templates = await prisma.template.findMany({ where: { companyId: req.params.id } });
    res.json({ templates });
  })
);

router.post(
  '/:id/templates',
  asyncHandler(async (req, res) => {
    assertCompanyScope(req, req.params.id);
    const body = z
      .object({
        name: z.string().min(1),
        type: z.enum(['EMAIL', 'SMS']),
        subject: z.string().optional(),
        body: z.string().min(1),
        workflow: z.string().optional(),
      })
      .parse(req.body);
    const template = await prisma.template.create({ data: { ...body, companyId: req.params.id } });
    res.status(201).json({ template });
  })
);

export default router;
