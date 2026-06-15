// Messaging service: the approval workflow and the actual send pipeline.
// Enforces consent, unsubscribe, and weekly frequency limits before anything
// leaves the building. This is the safety core of LeakHunter.
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { audit } from './audit';
import { getEmailProvider } from './email';
import { getSmsProvider } from './sms';

export class SendBlockedError extends Error {
  // Transient blocks (e.g. the weekly frequency cap) clear on their own, so the
  // message should stay queued for a later retry rather than being rejected.
  transient: boolean;
  constructor(message: string, transient = false) {
    super(message);
    this.name = 'SendBlockedError';
    this.transient = transient;
  }
}

const WEEK_MS = 1000 * 60 * 60 * 24 * 7;

/** Pre-send compliance gate. Throws SendBlockedError when a send is not allowed. */
export async function assertSendAllowed(messageId: string): Promise<void> {
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: true },
  });
  if (!message) throw new SendBlockedError('Message not found');
  const lead = message.lead;

  if (lead.unsubscribed) {
    throw new SendBlockedError('Lead has unsubscribed — sending blocked');
  }
  if (message.type === 'EMAIL' && !lead.email) {
    throw new SendBlockedError('Lead has no email address');
  }
  if (message.type === 'SMS' && !lead.phone) {
    throw new SendBlockedError('Lead has no phone number');
  }
  if (message.type === 'EMAIL' && !lead.consentEmail) {
    throw new SendBlockedError('No email consent recorded for this lead');
  }
  if (message.type === 'SMS' && !lead.consentSms) {
    throw new SendBlockedError('No SMS consent recorded for this lead');
  }

  // Frequency limit: count messages actually sent to this lead in the last week.
  const since = new Date(Date.now() - WEEK_MS);
  const recentSends = await prisma.message.count({
    where: {
      leadId: lead.id,
      direction: 'OUTBOUND',
      sentAt: { gte: since },
      status: { in: ['SENT', 'DELIVERED', 'OPENED', 'CLICKED'] },
    },
  });
  if (recentSends >= env.maxMessagesPerLeadPerWeek) {
    throw new SendBlockedError(
      `Frequency limit reached (${recentSends}/${env.maxMessagesPerLeadPerWeek} this week)`,
      true // transient: clears as older sends age out of the window
    );
  }
}

const APPROVABLE_FROM = ['DRAFT', 'PENDING_APPROVAL', 'REJECTED'] as const;

/** Approve a draft. Does NOT send — it moves it into the APPROVED queue. */
export async function approveMessage(messageId: string, approverId: string, scheduledFor?: Date) {
  const current = await prisma.message.findUnique({ where: { id: messageId }, select: { status: true } });
  if (!current) throw new SendBlockedError('Message not found');
  // Guard against double-approval re-sending an already-sent message.
  if (!APPROVABLE_FROM.includes(current.status as (typeof APPROVABLE_FROM)[number])) {
    throw new SendBlockedError(`Only un-sent drafts can be approved (current: ${current.status})`);
  }
  const message = await prisma.message.update({
    where: { id: messageId },
    data: {
      status: 'APPROVED',
      approvedById: approverId,
      scheduledFor: scheduledFor ?? null,
    },
  });
  await audit({
    actorId: approverId,
    action: 'message.approved',
    entity: 'Message',
    entityId: messageId,
    metadata: { scheduledFor: scheduledFor ?? null },
  });
  return message;
}

export async function rejectMessage(messageId: string, approverId: string, reason: string) {
  const message = await prisma.message.update({
    where: { id: messageId },
    data: { status: 'REJECTED', approvedById: approverId, rejectionReason: reason },
  });
  await audit({
    actorId: approverId,
    action: 'message.rejected',
    entity: 'Message',
    entityId: messageId,
    metadata: { reason },
  });
  return message;
}

/**
 * Actually deliver an APPROVED message via the configured provider.
 * Applies the compliance gate, records status transitions, and supports retry.
 */
export async function sendMessage(messageId: string, actorId?: string) {
  const message = await prisma.message.findUnique({ where: { id: messageId }, include: { lead: true } });
  if (!message) throw new SendBlockedError('Message not found');
  if (message.status !== 'APPROVED' && message.status !== 'FAILED') {
    throw new SendBlockedError(`Message must be APPROVED to send (current: ${message.status})`);
  }
  // Cap manual + scheduled retries so a permanently-broken recipient can't be
  // hammered (the cron path also filters on this, but manual /send bypassed it).
  if (message.retryCount >= 3) {
    throw new SendBlockedError(`Retry limit reached (${message.retryCount})`);
  }

  await assertSendAllowed(messageId);

  await prisma.message.update({ where: { id: messageId }, data: { status: 'QUEUED' } });

  // Wrap the provider call: a thrown exception (vs a {ok:false} result) must
  // not strand the message in QUEUED, where nothing would ever retry it.
  let result: { ok: boolean; providerId?: string; error?: string };
  try {
    if (message.type === 'EMAIL') {
      result = await getEmailProvider().send({
        to: message.lead.email!,
        subject: message.subject ?? 'A quick follow-up',
        body: message.content,
      });
    } else {
      result = await getSmsProvider().send({ to: message.lead.phone!, body: message.content });
    }
  } catch (err) {
    result = { ok: false, error: String(err) };
  }

  if (result.ok) {
    const sent = await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', sentAt: new Date(), providerId: result.providerId, failureReason: null },
    });
    await prisma.lead.update({
      where: { id: message.leadId },
      data: { lastContactedAt: new Date(), status: message.lead.status === 'NEW' ? 'CONTACTED' : undefined },
    });
    await audit({ actorId, action: 'message.sent', entity: 'Message', entityId: messageId });
    return sent;
  }

  const failed = await prisma.message.update({
    where: { id: messageId },
    data: { status: 'FAILED', failureReason: result.error, retryCount: { increment: 1 } },
  });
  await audit({
    actorId,
    action: 'message.failed',
    entity: 'Message',
    entityId: messageId,
    metadata: { error: result.error },
  });
  logger.warn('message send failed', { messageId, error: result.error });
  return failed;
}

/** Retry every APPROVED/FAILED message that is due. Returns counts. */
export async function processDueMessages(): Promise<{ sent: number; failed: number; blocked: number }> {
  const now = new Date();
  const due = await prisma.message.findMany({
    where: {
      status: { in: ['APPROVED', 'FAILED'] },
      retryCount: { lt: 3 },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    take: 50,
  });

  let sent = 0;
  let failed = 0;
  let blocked = 0;
  for (const m of due) {
    try {
      const r = await sendMessage(m.id);
      if (r.status === 'SENT') sent++;
      else failed++;
    } catch (err) {
      blocked++;
      if (err instanceof SendBlockedError) {
        if (err.transient) {
          // e.g. weekly frequency cap — leave APPROVED so it retries later.
          logger.info('send deferred (transient block)', { id: m.id, reason: err.message });
        } else {
          await prisma.message.update({
            where: { id: m.id },
            data: { status: 'REJECTED', rejectionReason: err.message },
          });
        }
      } else {
        logger.error('processDueMessages error', { id: m.id, err: String(err) });
      }
    }
  }
  return { sent, failed, blocked };
}
