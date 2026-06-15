// Rule-based lead scoring. This is the deterministic fallback that always runs;
// the AI layer (services/ai) can override the reason text but uses the same
// score buckets so behaviour stays predictable for a solo operator.

export type LeadScoreValue = 'HOT' | 'WARM' | 'COLD' | 'STALE' | 'DEAD';

export interface ScoreableLead {
  source?: string | null;
  status?: string | null;
  estimatedValue?: number | null;
  createdAt: Date;
  lastContactedAt?: Date | null;
  unsubscribed?: boolean;
  notesText?: string | null;
}

export interface ScoreResult {
  score: LeadScoreValue;
  reason: string;
}

const DAY = 1000 * 60 * 60 * 24;

export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.floor((now.getTime() - date.getTime()) / DAY);
}

/**
 * Classify a lead into HOT / WARM / COLD / STALE / DEAD using simple,
 * explainable rules tuned for roofing lead recovery.
 */
export function scoreLead(lead: ScoreableLead, now: Date = new Date()): ScoreResult {
  // DEAD always wins: explicit opt-out or confirmed no interest.
  if (lead.unsubscribed) {
    return { score: 'DEAD', reason: 'Lead unsubscribed / opted out — do not contact.' };
  }
  if (lead.status === 'CLOSED') {
    return { score: 'DEAD', reason: 'Lead is closed.' };
  }

  const ageDays = daysSince(lead.createdAt, now);
  const source = (lead.source || '').toLowerCase();
  const value = lead.estimatedValue || 0;
  const everContacted = !!lead.lastContactedAt;

  // High-intent recent signals.
  const highIntentSource =
    source.includes('missed_call') || source.includes('web_form') || source.includes('estimate');

  if (lead.status === 'RESPONDING' || lead.status === 'ESTIMATE' || lead.status === 'BOOKED') {
    return {
      score: 'HOT',
      reason: `Active in pipeline (${lead.status}). High intent — prioritize follow-up.`,
    };
  }

  if (ageDays <= 7 && highIntentSource) {
    return {
      score: 'HOT',
      reason: `Recent (${ageDays}d) high-intent ${source || 'lead'}. Reach out immediately.`,
    };
  }

  if (ageDays <= 30) {
    return {
      score: 'WARM',
      reason: `Lead is ${ageDays} days old${
        value ? ` with ~$${value} potential` : ''
      }. Still worth a personalized follow-up.`,
    };
  }

  if (ageDays <= 90) {
    return {
      score: 'COLD',
      reason: `Lead is ${ageDays} days old. Low urgency — good candidate for a re-engagement campaign.`,
    };
  }

  // Older than 90 days.
  if (!everContacted) {
    return {
      score: 'STALE',
      reason: `Old lead (${ageDays}d) that was never contacted — classic recoverable revenue.`,
    };
  }

  return {
    score: 'STALE',
    reason: `Old lead (${ageDays}d). Try one last re-engagement before marking dead.`,
  };
}

const PRIORITY: Record<LeadScoreValue, number> = {
  HOT: 5,
  WARM: 4,
  STALE: 3,
  COLD: 2,
  DEAD: 1,
};

/** Higher = should be worked first. */
export function scorePriority(score: LeadScoreValue): number {
  return PRIORITY[score] ?? 0;
}
