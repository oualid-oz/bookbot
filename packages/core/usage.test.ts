import { describe, it, expect } from 'vitest';
import { usagePeriodEnd, usagePeriodStart } from './usage';

describe('usage periods', () => {
  it('should start daily periods at UTC midnight', () => {
    // 23:30 at UTC-5 is already the next day in UTC
    const now = new Date('2026-03-31T23:30:00-05:00');
    expect(usagePeriodStart('daily', now).toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(usagePeriodEnd('daily', now).toISOString()).toBe('2026-04-02T00:00:00.000Z');
  });

  it('should start monthly periods on the 1st in UTC', () => {
    const now = new Date('2026-01-31T22:00:00Z');
    expect(usagePeriodStart('monthly', now).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(usagePeriodEnd('monthly', now).toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('should roll over the year', () => {
    const now = new Date('2026-12-31T23:59:59Z');
    expect(usagePeriodEnd('daily', now).toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect(usagePeriodEnd('monthly', now).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });
});
