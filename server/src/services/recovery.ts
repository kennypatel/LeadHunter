// Lead Recovery Engine: classify leads and generate follow-up drafts that land
// in the human approval queue. Nothing here sends — that is messaging.ts.
import { prisma } from '../lib/prisma';
import { audit } from './audit';
import { getAiProvider } from './ai';
import { Workflow } from '../utils/templates';
import { scoreLead } from '../utils/scoring';

/** (Re)classify a single lead and persist its score + reason. */
export async function classifyAndSave(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error('Lead not found');

  const result = await getAiProvider().classifyLead({
    source: lead.source,
    status: lead.status,
    estimatedValue: lead.estimatedValue,
    createdAt: lead.createdAt,
    lastContactedAt: lead.lastContactedAt,
    unsubscribed: lead.unsubscribed,
    notesText: lead.notesText,
  });

  return prisma.lead.update({
    where: { id: leadId },
    data: { score: result.score, scoreReason: result.reason },
  });
}

/** Pick a sensible default workflow from the lead's source/status. */
export function inferWorkflow(source?: string | null, status?: string | null): Workflow {
  const s = (source || '').toLowerCase();
  if (s.includes('missed_call')) return 'missed_call';
  if (status === 'ESTIMATE' || s.includes('estimate') || s.includes('quote')) return 'estimate_followup';
  return 're_engage';
}

export interface GenerateDraftOptions {
  leadId: string;
  type: 'EMAIL' | 'SMS';
  workflow?: Workflow;
  actorId?: string;
}

/**
 * Generate a follow-up draft for a lead and place it in the approval queue
 * (status PENDING_APPROVAL). Always editable by a human before send.
 */
export async function generateDraft(opts: GenerateDraftOptions) {
  const lead = await prisma.lead.findUnique({
    where: { id: opts.leadId },
    include: { company: true },
  });
  if (!lead) throw new Error('Lead not found');
  if (lead.unsubscribed) throw new Error('Lead unsubscribed — cannot draft outreach');

  const workflow = opts.workflow ?? inferWorkflow(lead.source, lead.status);

  // Pull short history for personalization.
  const history = await prisma.message.findMany({
    where: { leadId: lead.id },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { content: true },
  });

  const draft = await getAiProvider().draftMessage({
    workflow,
    type: opts.type,
    context: {
      leadName: lead.name,
      companyName: lead.company.name,
      companyPhone: lead.company.phone,
      estimatedValue: lead.estimatedValue,
    },
    history: history.map((h) => h.content),
  });

  const message = await prisma.message.create({
    data: {
      companyId: lead.companyId,
      leadId: lead.id,
      type: opts.type,
      direction: 'OUTBOUND',
      status: 'PENDING_APPROVAL',
      subject: draft.subject,
      content: draft.body,
      generatedBy: draft.generatedBy,
    },
  });

  await audit({
    actorId: opts.actorId,
    action: 'message.drafted',
    entity: 'Message',
    entityId: message.id,
    metadata: { workflow, type: opts.type, generatedBy: draft.generatedBy },
  });

  return message;
}

/**
 * Bulk workflow: classify a batch and generate drafts for everything that is
 * worth contacting (not dead/unsubscribed). Returns how many drafts were queued.
 */
export async function runBulkRecovery(params: {
  companyId: string;
  type: 'EMAIL' | 'SMS';
  workflow?: Workflow;
  limit?: number;
  actorId?: string;
}): Promise<{ queued: number; skipped: number }> {
  const leads = await prisma.lead.findMany({
    where: {
      companyId: params.companyId,
      unsubscribed: false,
      status: { notIn: ['BOOKED', 'CLOSED'] },
    },
    take: params.limit ?? 25,
    orderBy: { createdAt: 'asc' },
  });

  let queued = 0;
  let skipped = 0;
  for (const lead of leads) {
    // Refresh classification first.
    const result = scoreLead({
      source: lead.source,
      status: lead.status,
      estimatedValue: lead.estimatedValue,
      createdAt: lead.createdAt,
      lastContactedAt: lead.lastContactedAt,
      unsubscribed: lead.unsubscribed,
      notesText: lead.notesText,
    });
    await prisma.lead.update({
      where: { id: lead.id },
      data: { score: result.score, scoreReason: result.reason },
    });
    if (result.score === 'DEAD') {
      skipped++;
      continue;
    }
    // Require both an address AND consent on the chosen channel, so we don't
    // queue drafts the compliance gate will only reject at send time.
    const channelReady =
      params.type === 'EMAIL' ? !!lead.email && lead.consentEmail : !!lead.phone && lead.consentSms;
    if (!channelReady) {
      skipped++;
      continue;
    }
    await generateDraft({ leadId: lead.id, type: params.type, workflow: params.workflow, actorId: params.actorId });
    queued++;
  }

  await audit({
    actorId: params.actorId,
    action: 'recovery.bulk',
    entity: 'Company',
    entityId: params.companyId,
    metadata: { queued, skipped, type: params.type },
  });

  return { queued, skipped };
}
