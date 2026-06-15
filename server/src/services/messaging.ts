// Messaging service: the approval workflow and the actual send pipeline.
// Enforces consent, unsubscribe, and weekly frequency limits before anything
// leaves the building. This is the safety core of LeakHunter.
import { prisma } from '../lib/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { audit } from './audit';
import { getEmailProvider } from './email';
import { getSmsProvider } from './sms';
import { isFlagEnabled, SEND_FLAGS } from './featureFlags';
import { appendEmailFooter, buildEmailFooter, unsubscribeUrl } from '../utils/compliance';

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

/**
 * Live-send kill-switch. Real (non-console) sends are blocked unless BOTH the
 * master `live_sending` flag and the per-channel flag are enabled. The console
 * providers are no-ops (they only log), so they are always allowed — this keeps
 * local/dev/test flows working while real outreach stays gated by default.
 */
async function assertChannelLive(type: 'EMAIL' | 'SMS'): Promise<void> {
  const providerIsReal = type === 'EMAIL' ? env.email.provider !== 'console' : env.sms.provider !== 'console';
  if (!providerIsReal) return;
  const channelFlag = type === 'EMAIL' ? SEND_FLAGS.email : SEND_FLAGS.sms;
  const [masterOn, channelOn] = await Promise.all([isFlagEnabled(SEND_FLAGS.live), isFlagEnabled(channelFlag)]);
  if (!masterOn || !channelOn) {
    throw new SendBlockedError(
      `Live ${type} sending is disabled — enable feature flags '${SEND_FLAGS.live}' and '${channelFlag}'`,
      true // transient: flipping the flag on lets queued messages go out
    );
  }
}

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
  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { lead: true, company: true },
  });
  if (!message) throw new SendBlockedError('Message not found');
  // QUEUED is included so a send that was interrupted mid-flight (e.g. a host
  // dropped the SMTP connection) can be safely retried instead of being stuck.
  if (!['APPROVED', 'FAILED', 'QUEUED'].includes(message.status)) {
    throw new SendBlockedError(`Message must be APPROVED to send (current: ${message.status})`);
  }
  // Cap manual + scheduled retries so a permanently-broken recipient can't be
  // hammered (the cron path also filters on this, but manual /send bypassed it).
  if (message.retryCount >= 3) {
    throw new SendBlockedError(`Retry limit reached (${message.retryCount})`);
  }

  await assertSendAllowed(messageId);
  await assertChannelLive(message.type);

  await prisma.message.update({ where: { id: messageId }, data: { status: 'QUEUED' } });

  // Wrap the provider call: a thrown exception (vs a {ok:false} result) must
  // not strand the message in QUEUED, where nothing would ever retry it.
  let result: { ok: boolean; providerId?: string; error?: string };
  try {
    if (message.type === 'EMAIL') {
      // CAN-SPAM: every email carries the sender, a physical address, and a
      // working unsubscribe link.
      const footer = buildEmailFooter({
        companyName: message.company.name,
        address: message.company.address || env.businessAddress || null,
        unsubscribeUrl: unsubscribeUrl(env.publicUrl, message.leadId),
      });
      // One-click unsubscribe endpoint (accepts POST) for the List-Unsubscribe header.
      const oneClickUrl = `${env.publicUrl.replace(/\/+$/, '')}/api/public/unsubscribe?lead=${message.leadId}`;
      result = await getEmailProvider().send({
        to: message.lead.email!,
        subject: message.subject ?? 'A quick follow-up',
        body: appendEmailFooter(message.content, footer),
        unsubscribeUrl: oneClickUrl,
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
  // Recover messages stuck in QUEUED for >2 min (an interrupted send).
  const staleQueued = new Date(now.getTime() - 2 * 60 * 1000);
  const due = await prisma.message.findMany({
    where: {
      retryCount: { lt: 3 },
      OR: [
        {
          status: { in: ['APPROVED', 'FAILED'] },
          OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
        },
        { status: 'QUEUED', updatedAt: { lte: staleQueued } },
      ],
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
