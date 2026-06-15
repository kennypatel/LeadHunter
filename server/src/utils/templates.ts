// Personalization-token rendering plus the built-in message templates that act
// as the deterministic fallback when the AI provider is unavailable.

export type TemplateTokens = Record<string, string | number | null | undefined>;

/**
 * Render {{token}} placeholders. Unknown tokens are replaced with an empty
 * string so a missing field never leaks "{{firstName}}" into a customer's inbox.
 */
export function renderTemplate(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key: string) => {
    const value = tokens[key];
    return value === undefined || value === null ? '' : String(value);
  });
}

/**
 * Like renderTemplate, but only substitutes tokens we have values for and
 * leaves the rest as literal {{placeholders}}. Used for sales drafts the
 * operator finishes filling in by hand.
 */
export function fillTokensPartial(template: string, tokens: TemplateTokens): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key: string) => {
    const value = tokens[key];
    return value === undefined || value === null || value === '' ? match : String(value);
  });
}

export function firstName(fullName?: string | null): string {
  if (!fullName) return 'there';
  return fullName.trim().split(/\s+/)[0] || 'there';
}

export type Workflow = 'missed_call' | 're_engage' | 'estimate_followup';

export interface BuiltInTemplate {
  workflow: Workflow;
  type: 'EMAIL' | 'SMS';
  subject?: string;
  body: string;
}

// These ship with every account so a new client can go live without writing copy.
export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  {
    workflow: 'missed_call',
    type: 'SMS',
    body:
      "Hi {{firstName}}, this is {{companyName}} — sorry we missed your call! " +
      'Were you reaching out about a roof repair or estimate? Happy to help. Reply STOP to opt out.',
  },
  {
    workflow: 'missed_call',
    type: 'EMAIL',
    subject: 'Sorry we missed your call, {{firstName}}',
    body:
      'Hi {{firstName}},\n\nWe saw we missed your call at {{companyName}}. ' +
      "We'd love to help with your roofing needs — just reply to this email or call us back at {{companyPhone}} " +
      'and we\'ll get you a fast, free estimate.\n\nThanks,\n{{companyName}}',
  },
  {
    workflow: 're_engage',
    type: 'SMS',
    body:
      'Hi {{firstName}}, {{companyName}} here. We had your info from a while back about roofing work. ' +
      'Still need help? We have crews available this month. Reply STOP to opt out.',
  },
  {
    workflow: 're_engage',
    type: 'EMAIL',
    subject: 'Still thinking about that roof, {{firstName}}?',
    body:
      'Hi {{firstName}},\n\nA little while ago you reached out to {{companyName}} about roofing work. ' +
      "We're following up to see if you still need help. We're booking estimates now and can usually " +
      'get someone out within a few days.\n\nWant us to take a look? Just reply here.\n\n{{companyName}}\n{{companyPhone}}',
  },
  {
    workflow: 'estimate_followup',
    type: 'SMS',
    body:
      'Hi {{firstName}}, following up on the {{companyName}} estimate we sent ({{estimateValue}}). ' +
      'Any questions? Happy to adjust scope or schedule. Reply STOP to opt out.',
  },
  {
    workflow: 'estimate_followup',
    type: 'EMAIL',
    subject: 'Quick follow-up on your roofing estimate',
    body:
      'Hi {{firstName}},\n\nJust checking in on the estimate from {{companyName}} ({{estimateValue}}). ' +
      "We'd hate for you to miss your spot in our schedule. If the timing or price needs adjusting, " +
      "let's talk — reply here or call {{companyPhone}}.\n\nBest,\n{{companyName}}",
  },
];

export function getBuiltInTemplate(
  workflow: Workflow,
  type: 'EMAIL' | 'SMS'
): BuiltInTemplate | undefined {
  return BUILT_IN_TEMPLATES.find((t) => t.workflow === workflow && t.type === type);
}

export interface DraftContext {
  leadName?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
  estimatedValue?: number | null;
}

/** Build the token map used to render any template for a lead. */
export function buildTokens(ctx: DraftContext): TemplateTokens {
  return {
    firstName: firstName(ctx.leadName),
    leadName: ctx.leadName || 'there',
    companyName: ctx.companyName || 'our team',
    companyPhone: ctx.companyPhone || '',
    estimateValue: ctx.estimatedValue ? `$${ctx.estimatedValue.toLocaleString()}` : 'your estimate',
    estimatedValue: ctx.estimatedValue ?? '',
  };
}
