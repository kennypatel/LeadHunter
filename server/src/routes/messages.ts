import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { authenticate, requireRole, scopedCompanyId } from '../middleware/auth';
import { asyncHandler, HttpError } from '../middleware/error';
import {
  approveMessage,
  rejectMessage,
  sendMessage,
  processDueMessages,
  SendBlockedError,
} from '../services/messaging';

const router = Router();
router.use(authenticate);

// List messages, optionally filtered by status (e.g. the approval queue).
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const companyId = scopedCompanyId(req, req.query.companyId as string);
    const where: Prisma.MessageWhereInput = {};
    if (companyId) where.companyId = companyId;
    else if (req.user!.role !== 'ADMIN') return res.json({ messages: [] });
    if (req.query.status) where.status = req.query.status as Prisma.MessageWhereInput['status'];
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { lead: { select: { name: true, email: true, phone: true } } },
    });
    res.json({ messages });
  })
);

// The approval queue is just messages PENDING_APPROVAL.
router.get(
  '/queue',
  asyncHandler(async (req, res) => {
    const companyId = scopedCompanyId(req, req.query.companyId as string);
    const where: Prisma.MessageWhereInput = { status: 'PENDING_APPROVAL' };
    if (companyId) where.companyId = companyId;
    // A non-admin with no company in scope must never see a global queue.
    else if (req.user!.role !== 'ADMIN') return res.json({ messages: [] });
    const messages = await prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: { lead: { select: { name: true, email: true, phone: true, score: true } } },
    });
    res.json({ messages });
  })
);

// Edit a draft before approval (all AI output is human-editable).
router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = z.object({ subject: z.string().optional(), content: z.string().min(1).optional() }).parse(req.body);
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    if (!message) throw new HttpError(404, 'Message not found');
    if (!['DRAFT', 'PENDING_APPROVAL', 'REJECTED'].includes(message.status)) {
      throw new HttpError(400, 'Only un-sent drafts can be edited');
    }
    const updated = await prisma.message.update({
      where: { id: req.params.id },
      data: { ...body, generatedBy: 'human' },
    });
    res.json({ message: updated });
  })
);

const approveSchema = z.object({ scheduledFor: z.string().optional(), sendNow: z.boolean().optional() });
router.post(
  '/:id/approve',
  asyncHandler(async (req, res) => {
    const { scheduledFor, sendNow } = approveSchema.parse(req.body);
    try {
      await approveMessage(req.params.id, req.user!.id, scheduledFor ? new Date(scheduledFor) : undefined);
      if (sendNow) {
        const sent = await sendMessage(req.params.id, req.user!.id);
        return res.json({ message: sent });
      }
    } catch (err) {
      if (err instanceof SendBlockedError) throw new HttpError(422, err.message);
      throw err;
    }
    const message = await prisma.message.findUnique({ where: { id: req.params.id } });
    res.json({ message });
  })
);

router.post(
  '/:id/reject',
  asyncHandler(async (req, res) => {
    const reason = z.object({ reason: z.string().min(1) }).parse(req.body).reason;
    const message = await rejectMessage(req.params.id, req.user!.id, reason);
    res.json({ message });
  })
);

// Manual send / retry of an already-approved (or failed) message.
router.post(
  '/:id/send',
  asyncHandler(async (req, res) => {
    try {
      const message = await sendMessage(req.params.id, req.user!.id);
      res.json({ message });
    } catch (err) {
      if (err instanceof SendBlockedError) throw new HttpError(422, err.message);
      throw err;
    }
  })
);

// Process the scheduled/retry queue (admin or cron).
router.post(
  '/process-due',
  requireRole('ADMIN'),
  asyncHandler(async (_req, res) => {
    const result = await processDueMessages();
    res.json(result);
  })
);

export default router;
