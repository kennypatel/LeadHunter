// Polished sales outreach templates the operator uses to sign New Jersey
// roofing companies as LeakHunter clients. Static, curated copy surfaced in the
// app (Sales Templates page) with copy-to-clipboard. Tokens are filled before
// sending: {{firstName}} + {{companyName}} = the roofing prospect;
// {{senderName}}, {{senderTitle}}, {{senderCompany}}, {{calendarLink}} = you.

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
  '{{senderTitle}}',
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
    subject: 'Quick question about your old leads',
    body: `Hi,

Most roofing companies are sitting on a goldmine they've forgotten about: missed calls, old quotes, and estimates that quietly went cold. Those homeowners were ready to buy once — most just need a nudge.

I built a system that revives them for you. It imports your old leads, drafts a personalized text and email for each one, and routes everything to you for a quick approval before a single message goes out. No new ad spend, no cold lists — just revenue {{companyName}} already paid to create.

I'd like to run a free audit of your missed calls and old leads and show you, in real dollars, what's recoverable. Worth 15 minutes?

{{senderName}}
{{senderTitle}}, {{senderCompany}}
{{calendarLink}}`,
  },
  {
    id: 'email-2-bump',
    category: 'Cold email sequence',
    name: 'Email 2 — Follow-up (3 days later)',
    channel: 'EMAIL',
    subject: 're: Quick question about your old leads',
    body: `Hi,

Floating this back to the top. Even recovering 2–3 extra roofs a month — from leads you already have — is a serious number, with zero added marketing cost.

Want me to run the free audit? Just reply "audit" and I'll handle the rest.

{{senderName}}`,
  },
  {
    id: 'email-3-proof',
    category: 'Cold email sequence',
    name: 'Email 3 — How it works (5 days later)',
    channel: 'EMAIL',
    subject: 'how roofers turn old quotes into booked jobs',
    body: `Hi,

Here's the playbook in plain English: we load your old leads, the system writes a personal follow-up for each, and you approve them in batches — nothing sends without your okay. Replies come in, estimates get booked, and you stop leaving money on the table.

The best part: these are your leads. I'm just making sure none of them slip away.

Got 15 minutes this week? {{calendarLink}}

{{senderName}}
{{senderTitle}}, {{senderCompany}}`,
  },
  {
    id: 'email-4-breakup',
    category: 'Cold email sequence',
    name: 'Email 4 — Breakup (7 days later)',
    channel: 'EMAIL',
    subject: 'Closing your file?',
    body: `Hi,

I don't want to keep cluttering your inbox. If reviving old leads isn't a priority for {{companyName}} right now, no hard feelings — I'll close this out.

But if there's any chance it is, just reply and I'll send over the free audit. It costs you nothing and usually pays for itself many times over.

Either way, thanks for your time.

{{senderName}}
{{senderTitle}}, {{senderCompany}}`,
  },

  // --- Other channels -----------------------------------------------------
  {
    id: 'sms-intro',
    category: 'Text message',
    name: 'Intro text',
    channel: 'SMS',
    body: `Hi {{firstName}}, it's {{senderName}} from {{senderCompany}}. I help {{city}} roofers turn missed calls & old quotes into booked jobs — no new ad spend. Open to a quick free audit? Reply STOP to opt out.`,
  },
  {
    id: 'voicemail',
    category: 'Voicemail',
    name: 'Voicemail script',
    channel: 'CALL',
    body: `Hi {{firstName}}, this is {{senderName}}, {{senderTitle}} at {{senderCompany}}. I help roofers around {{city}} turn missed calls and old estimates into booked jobs — revenue you already paid to generate. I'll follow up by email; if it's a fit, I'd love to run a free audit for {{companyName}}. Talk soon.`,
  },
  {
    id: 'linkedin-connect',
    category: 'LinkedIn',
    name: 'Connection request',
    channel: 'LINKEDIN',
    body: `Hi {{firstName}} — I help roofing companies recover revenue from missed calls and old quotes. Would love to connect and share a quick idea for {{companyName}}.`,
  },

  // --- Helpers ------------------------------------------------------------
  {
    id: 'subject-lines',
    category: 'Subject line bank',
    name: 'Subject lines to A/B test',
    channel: 'NOTE',
    body: `• the leads {{companyName}} already paid for
• {{firstName}}, recovering booked jobs for {{companyName}}
• missed calls at {{companyName}}?
• {{city}} roofers are leaving this on the table
• a quick idea for {{companyName}}'s old quotes`,
  },
  {
    id: 'pilot-offer',
    category: 'Offer',
    name: 'Pilot offer (use after a yes)',
    channel: 'NOTE',
    body: `Here's a simple way to start, {{firstName}}:

PILOT — $500 one-time
• Full audit of your missed calls + old leads
• Import up to 500 leads
• 2 recovery campaigns (you approve every message)
• A clear report of exactly what we recovered

If it pays for itself — and it usually does — we move to a simple monthly retainer to keep it running. No long-term contract, cancel anytime.

Want me to set up the pilot? {{calendarLink}}

{{senderName}}
{{senderTitle}}, {{senderCompany}}`,
  },
];

/** The default sales template used when an operator drafts an outreach message. */
export function getSalesTemplate(type: 'EMAIL' | 'SMS'): SalesTemplate {
  const id = type === 'EMAIL' ? 'email-1-opener' : 'sms-intro';
  return SALES_TEMPLATES.find((t) => t.id === id) ?? SALES_TEMPLATES[0];
}
