// Compliance helpers: opt-out (STOP) detection and the CAN-SPAM email footer.
// Pure and dependency-free so they are unit-tested without a DB or provider.

// Standard carrier opt-out keywords (Twilio honors these at the carrier level;
// we also record them in our own data so the lead is never contacted again).
export const STOP_KEYWORDS = [
  'STOP',
  'STOPALL',
  'UNSUBSCRIBE',
  'CANCEL',
  'END',
  'QUIT',
  'REMOVE',
  'OPTOUT',
];

/** True when an inbound SMS body is an opt-out request. */
export function isOptOutMessage(body: string | null | undefined): boolean {
  if (!body) return false;
  // Normalize: take the first "word", strip punctuation/whitespace, uppercase.
  const first = body.trim().toUpperCase().replace(/[^A-Z]/g, ' ').split(/\s+/).filter(Boolean)[0];
  if (!first) return false;
  return STOP_KEYWORDS.includes(first);
}

/** Build the public unsubscribe URL for a lead. */
export function unsubscribeUrl(baseUrl: string, leadId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/legal/unsubscribe?lead=${encodeURIComponent(leadId)}`;
}

export interface EmailFooterOpts {
  companyName: string;
  address?: string | null;
  unsubscribeUrl: string;
}

/**
 * CAN-SPAM-compliant email footer: identifies the sender, includes a physical
 * mailing address, and provides a working unsubscribe link.
 */
export function buildEmailFooter(opts: EmailFooterOpts): string {
  const lines = ['—', opts.companyName];
  if (opts.address) lines.push(opts.address);
  lines.push(`Unsubscribe: ${opts.unsubscribeUrl}`);
  return lines.join('\n');
}

/** Append the footer to an email body, avoiding double blank lines. */
export function appendEmailFooter(body: string, footer: string): string {
  return `${body.replace(/\s+$/, '')}\n\n${footer}`;
}
