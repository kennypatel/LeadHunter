// Polished sales outreach templates the operator uses to sign New Jersey
// roofing companies as LeakHunter clients. Static, curated copy surfaced in the
// app (Sales Templates page) with copy-to-clipboard. Tokens are filled in by the
// operator before sending: {{firstName}}, {{companyName}}, {{city}},
// {{senderName}}, {{senderCompany}}, {{calendarLink}}.

export interface SalesTemplate {
  id: string;
  category: string;
  name: string;
  channel: 'EMAIL' | 'SMS' | 'CALL' | 'LINKEDIN' | 'NOTE';
  subject?: string;
  body: string;
}

export const SALES_TOKENS = [
  '{{firstName}}',
  '{{companyName}}',
  '{{city}}',
  '{{senderName}}',
  '{{senderCompany}}',
  '{{calendarLink}}',
];

export const SALES_TEMPLATES: SalesTemplate[] = [
  // --- Cold email sequence ------------------------------------------------
  {
    id: 'email-1-opener',
    category: 'Cold email sequence',
    name: 'Email 1 — Opener',
    channel: 'EMAIL',
    subject: 'missed calls at {{companyName}}?',
    body: `Hi {{firstName}},

Quick one — when a homeowner calls {{companyName}} and no one picks up, or an estimate goes quiet, that job usually doesn't come back. Most roofers I talk to around {{city}} have hundreds of those sitting in a spreadsheet or voicemail.

I set up a simple system that revives those leads — missed calls, old quotes, unanswered estimates — with personalized follow-ups you approve before anything sends. No new ad spend; it just recovers revenue you already paid to generate.

Worth a 15-minute look? I'll run a free audit of your missed calls and old leads and show you what's recoverable.

{{senderName}}
{{senderCompany}}
{{calendarLink}}`,
  },
  {
    id: 'email-2-bump',
    category: 'Cold email sequence',
    name: 'Email 2 — Follow-up (3 days later)',
    channel: 'EMAIL',
    subject: 're: missed calls at {{companyName}}',
    body: `Hi {{firstName}},

Floating this back to the top. Even 2–3 recovered roofs a month — from leads you already have — is real money with zero extra ad spend.

If it's worth a look, just reply "audit" and I'll take it from there.

{{senderName}}`,
  },
  {
    id: 'email-3-proof',
    category: 'Cold email sequence',
    name: 'Email 3 — Proof (5 days later)',
    channel: 'EMAIL',
    subject: 'turning old quotes into booked jobs',
    body: `Hi {{firstName}},

Here's how it works in practice: a roofer imports their old leads, the system drafts a personalized text/email for each one, and they approve them in batches — nothing sends without a human okay. Replies come back in, estimates get booked.

The leads are already yours. This just makes sure none of them quietly slip away.

Open to a quick 15 minutes this week? {{calendarLink}}

{{senderName}}`,
  },
  {
    id: 'email-4-breakup',
    category: 'Cold email sequence',
    name: 'Email 4 — Breakup (7 days later)',
    channel: 'EMAIL',
    subject: 'should I close your file, {{firstName}}?',
    body: `Hi {{firstName}},

I don't want to keep landing in your inbox. If reviving old leads isn't a priority for {{companyName}} right now, no problem — I'll close it out.

If it is, just reply and I'll send over the free audit. Either way, I appreciate your time.

{{senderName}}
{{senderCompany}}`,
  },

  // --- Other channels -----------------------------------------------------
  {
    id: 'sms-intro',
    category: 'Text message',
    name: 'Intro text',
    channel: 'SMS',
    body: `Hi {{firstName}}, {{senderName}} here — I help {{city}} roofers turn missed calls & old quotes into booked jobs (no new ad spend). Open to a quick free audit? Reply STOP to opt out.`,
  },
  {
    id: 'voicemail',
    category: 'Voicemail',
    name: 'Voicemail script',
    channel: 'CALL',
    body: `Hey {{firstName}}, it's {{senderName}} with {{senderCompany}}. I help roofers around {{city}} turn missed calls and old estimates into booked jobs — revenue you already paid to generate. I'll follow up with a quick email; if it's interesting, I'd love to run a free audit for {{companyName}}. Talk soon.`,
  },
  {
    id: 'linkedin-connect',
    category: 'LinkedIn',
    name: 'Connection request',
    channel: 'LINKEDIN',
    body: `Hi {{firstName}} — I help NJ roofers recover revenue from missed calls and old quotes. Would love to connect and share a quick idea for {{companyName}}.`,
  },

  // --- Helpers ------------------------------------------------------------
  {
    id: 'subject-lines',
    category: 'Subject line bank',
    name: 'Subject lines to A/B test',
    channel: 'NOTE',
    body: `• missed calls at {{companyName}}?
• {{firstName}}, leads you already paid for
• quick question about {{companyName}}'s old quotes
• recovering booked jobs for {{companyName}}
• {{city}} roofers are leaving this on the table`,
  },
  {
    id: 'pilot-offer',
    category: 'Offer',
    name: 'Pilot offer (use after a yes)',
    channel: 'NOTE',
    body: `Here's a simple way to start, {{firstName}}:

PILOT — $500 one-time
• Audit of your missed calls + old leads
• Import up to 500 leads
• 2 recovery campaigns (you approve every message)
• A clear report of what we recovered

If it pays for itself (it usually does), we move to a monthly retainer to keep it running. No long-term contract.

Want me to get the pilot set up? {{calendarLink}}`,
  },
];

/** The default sales template used when an operator drafts an outreach message. */
export function getSalesTemplate(type: 'EMAIL' | 'SMS'): SalesTemplate {
  const id = type === 'EMAIL' ? 'email-1-opener' : 'sms-intro';
  return SALES_TEMPLATES.find((t) => t.id === id) ?? SALES_TEMPLATES[0];
}
