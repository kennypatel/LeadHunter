import { parseLeadsCsv, normalizePhone, normalizeEmail, dedupeKey } from '../csv';

describe('normalizePhone', () => {
  it('strips formatting and keeps last 10 digits', () => {
    expect(normalizePhone('(908) 555-1234')).toBe('9085551234');
    expect(normalizePhone('+1 908 555 1234')).toBe('9085551234');
  });
  it('rejects too-short numbers', () => {
    expect(normalizePhone('123')).toBeNull();
  });
});

describe('normalizeEmail', () => {
  it('lowercases and validates', () => {
    expect(normalizeEmail('Dana@Example.com ')).toBe('dana@example.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
  });
});

describe('dedupeKey', () => {
  it('prefers phone, then email, then name', () => {
    expect(dedupeKey({ phone: '908-555-1234', email: 'a@b.com' })).toBe('9085551234');
    expect(dedupeKey({ email: 'A@B.com' })).toBe('a@b.com');
    expect(dedupeKey({ name: 'Jane Doe' })).toBe('jane doe');
  });
});

describe('parseLeadsCsv', () => {
  it('parses headers with aliases and coerces values', () => {
    const csv = 'Full Name,Phone Number,Email,Estimate\nDana Smith,(908) 555-1234,dana@example.com,"$12,000"';
    const result = parseLeadsCsv(csv);
    expect(result.leads).toHaveLength(1);
    expect(result.leads[0].name).toBe('Dana Smith');
    expect(result.leads[0].estimatedValue).toBe(12000);
  });

  it('deduplicates within the file by phone', () => {
    const csv =
      'name,phone\n' +
      'Dana,908-555-1234\n' +
      'Dana Dup,(908) 555 1234\n' +
      'Other,973-555-0000';
    const result = parseLeadsCsv(csv);
    expect(result.leads).toHaveLength(2);
    expect(result.duplicatesInFile).toBe(1);
  });

  it('synthesizes a name when missing', () => {
    const csv = 'email,phone\nx@y.com,9085551234';
    const result = parseLeadsCsv(csv);
    expect(result.leads[0].name).toBe('x@y.com');
  });
});
