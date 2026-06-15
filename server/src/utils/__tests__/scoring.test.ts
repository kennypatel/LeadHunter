import { scoreLead, scorePriority, daysSince } from '../scoring';

const NOW = new Date('2026-06-15T12:00:00Z');
function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

describe('scoreLead', () => {
  it('marks unsubscribed leads DEAD regardless of recency', () => {
    const r = scoreLead({ createdAt: daysAgo(1), unsubscribed: true, source: 'missed_call' }, NOW);
    expect(r.score).toBe('DEAD');
  });

  it('marks closed leads DEAD', () => {
    const r = scoreLead({ createdAt: daysAgo(1), status: 'CLOSED' }, NOW);
    expect(r.score).toBe('DEAD');
  });

  it('treats active pipeline statuses as HOT', () => {
    expect(scoreLead({ createdAt: daysAgo(200), status: 'RESPONDING' }, NOW).score).toBe('HOT');
    expect(scoreLead({ createdAt: daysAgo(200), status: 'BOOKED' }, NOW).score).toBe('HOT');
  });

  it('marks recent high-intent leads HOT', () => {
    const r = scoreLead({ createdAt: daysAgo(2), source: 'missed_call', status: 'NEW' }, NOW);
    expect(r.score).toBe('HOT');
  });

  it('marks 2-week-old leads WARM', () => {
    const r = scoreLead({ createdAt: daysAgo(14), source: 'web_form', status: 'NEW' }, NOW);
    expect(r.score).toBe('WARM');
  });

  it('marks 60-day leads COLD', () => {
    const r = scoreLead({ createdAt: daysAgo(60), source: 'csv_import', status: 'NEW' }, NOW);
    expect(r.score).toBe('COLD');
  });

  it('marks very old, never-contacted leads STALE', () => {
    const r = scoreLead({ createdAt: daysAgo(200), source: 'old_quote', status: 'NEW' }, NOW);
    expect(r.score).toBe('STALE');
    expect(r.reason).toMatch(/never contacted/i);
  });

  it('always returns a human-readable reason', () => {
    const r = scoreLead({ createdAt: daysAgo(5), source: 'web_form' }, NOW);
    expect(r.reason.length).toBeGreaterThan(5);
  });
});

describe('scorePriority', () => {
  it('orders HOT above WARM above DEAD', () => {
    expect(scorePriority('HOT')).toBeGreaterThan(scorePriority('WARM'));
    expect(scorePriority('WARM')).toBeGreaterThan(scorePriority('DEAD'));
  });
});

describe('daysSince', () => {
  it('computes whole days elapsed', () => {
    expect(daysSince(daysAgo(3), NOW)).toBe(3);
  });
});
