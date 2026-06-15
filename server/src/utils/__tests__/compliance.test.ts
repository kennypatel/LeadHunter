import { isOptOutMessage, unsubscribeUrl, buildEmailFooter, appendEmailFooter } from '../compliance';

describe('isOptOutMessage', () => {
  it('detects standard opt-out keywords case/whitespace-insensitively', () => {
    for (const w of ['STOP', 'stop', '  Stop  ', 'STOP.', 'unsubscribe', 'CANCEL', 'quit']) {
      expect(isOptOutMessage(w)).toBe(true);
    }
  });
  it('detects opt-out as the first word of a longer message', () => {
    expect(isOptOutMessage('STOP texting me please')).toBe(true);
  });
  it('does not flag normal replies', () => {
    expect(isOptOutMessage('Yes please call me')).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
    expect(isOptOutMessage(null)).toBe(false);
  });
});

describe('unsubscribeUrl', () => {
  it('builds a link and trims trailing slashes', () => {
    expect(unsubscribeUrl('https://app.example.com/', 'lead_123')).toBe(
      'https://app.example.com/legal/unsubscribe?lead=lead_123'
    );
  });
});

describe('email footer', () => {
  it('includes sender, address, and unsubscribe link (CAN-SPAM)', () => {
    const footer = buildEmailFooter({
      companyName: 'ABC Roofing',
      address: '1 Main St, Newark NJ',
      unsubscribeUrl: 'https://x/u?lead=1',
    });
    expect(footer).toContain('ABC Roofing');
    expect(footer).toContain('1 Main St, Newark NJ');
    expect(footer).toContain('Unsubscribe: https://x/u?lead=1');
  });
  it('omits the address line when none is set', () => {
    const footer = buildEmailFooter({ companyName: 'ABC', address: null, unsubscribeUrl: 'u' });
    expect(footer.split('\n')).toHaveLength(3); // dash, name, unsubscribe
  });
  it('appends with a clean separator', () => {
    expect(appendEmailFooter('Hello.\n\n', 'FOOT')).toBe('Hello.\n\nFOOT');
  });
});
