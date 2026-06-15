import { renderTemplate, buildTokens, getBuiltInTemplate, firstName, fillTokensPartial } from '../templates';

describe('renderTemplate', () => {
  it('replaces known tokens', () => {
    expect(renderTemplate('Hi {{firstName}}!', { firstName: 'Dana' })).toBe('Hi Dana!');
  });

  it('handles whitespace inside braces', () => {
    expect(renderTemplate('Hi {{ firstName }}', { firstName: 'Dana' })).toBe('Hi Dana');
  });

  it('replaces unknown tokens with empty string (never leaks placeholders)', () => {
    expect(renderTemplate('Hi {{missing}}!', {})).toBe('Hi !');
  });
});

describe('fillTokensPartial', () => {
  it('fills known tokens and leaves the rest as visible placeholders', () => {
    const out = fillTokensPartial('Hi {{firstName}} at {{companyName}}, from {{senderName}}', {
      firstName: 'Dana',
      senderName: 'Sam',
    });
    expect(out).toBe('Hi Dana at {{companyName}}, from Sam');
  });
  it('treats empty values as not provided (keeps placeholder)', () => {
    expect(fillTokensPartial('Hi {{firstName}}', { firstName: '' })).toBe('Hi {{firstName}}');
  });
});

describe('firstName', () => {
  it('returns first word', () => {
    expect(firstName('Dana Smith')).toBe('Dana');
  });
  it('falls back to "there"', () => {
    expect(firstName(null)).toBe('there');
    expect(firstName('')).toBe('there');
  });
});

describe('buildTokens + built-in templates', () => {
  it('renders the missed_call SMS with personalization and opt-out', () => {
    const tmpl = getBuiltInTemplate('missed_call', 'SMS')!;
    const out = renderTemplate(tmpl.body, buildTokens({ leadName: 'Dana Smith', companyName: 'ABC Roofing' }));
    expect(out).toContain('Dana');
    expect(out).toContain('ABC Roofing');
    expect(out).toMatch(/STOP/);
  });

  it('formats estimate value', () => {
    const tokens = buildTokens({ leadName: 'Dana', estimatedValue: 12000 });
    expect(tokens.estimateValue).toBe('$12,000');
  });
});
