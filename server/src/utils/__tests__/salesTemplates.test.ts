import { getSalesTemplate, SALES_TEMPLATES, SALES_TOKENS } from '../salesTemplates';
import { renderTemplate } from '../templates';

// The token set generateDraft fills for a sales draft (all non-empty).
const tokens = {
  firstName: 'Dana',
  companyName: 'Summit Roofing',
  city: 'Essex County',
  senderName: 'Sam',
  senderCompany: 'KSP Marketing',
  calendarLink: 'just reply and we will find a time',
};

describe('sales draft rendering leaves no empty tokens', () => {
  it.each(['EMAIL', 'SMS'] as const)('%s draft has no leftover {{tokens}}', (type) => {
    const tmpl = getSalesTemplate(type);
    const subject = tmpl.subject ? renderTemplate(tmpl.subject, tokens) : '';
    const body = renderTemplate(tmpl.body, tokens);
    expect(subject).not.toMatch(/\{\{|\}\}/);
    expect(body).not.toMatch(/\{\{|\}\}/);
    expect(body).toContain('Dana');
  });

  it('every token used across all templates is a known SALES token', () => {
    const used = new Set<string>();
    for (const t of SALES_TEMPLATES) {
      for (const m of `${t.subject ?? ''} ${t.body}`.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)) {
        used.add(`{{${m[1]}}}`);
      }
    }
    for (const token of used) {
      expect(SALES_TOKENS).toContain(token);
    }
  });
});
