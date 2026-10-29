/**
 * Usage periods for plan limits. Always UTC, so a period means the same
 * thing no matter which time zone the server runs in.
 */
export type UsagePeriod = 'daily' | 'monthly';

export function usagePeriodStart(period: UsagePeriod, now: Date = new Date()): Date {
  return period === 'daily'
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Start of the next period, i.e. when the current usage resets */
export function usagePeriodEnd(period: UsagePeriod, now: Date = new Date()): Date {
  const start = usagePeriodStart(period, now);
  return period === 'daily'
    ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + 1))
    : new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
}
