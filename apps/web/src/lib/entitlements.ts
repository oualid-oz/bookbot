import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { subscriptions, entitlementsUsage } from '@bookbot/db/schema';
import { usagePeriodEnd, usagePeriodStart, type UsagePeriod } from '@bookbot/core';

// Plan limits configuration
export const PLAN_LIMITS = {
  free: {
    exportsPerMonth: 5,
    aiCredits: 10,
    keywordLookupsPerDay: 20,
    projects: 3,
  },
  pro: {
    exportsPerMonth: 100,
    aiCredits: 500,
    keywordLookupsPerDay: 500,
    projects: 50,
  },
  enterprise: {
    exportsPerMonth: -1, // unlimited
    aiCredits: -1,
    keywordLookupsPerDay: -1,
    projects: -1,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

/** Metrics counted per period. (Projects are a standing count, checked directly.) */
export type UsageMetric = 'exportsPerMonth' | 'aiCredits' | 'keywordLookupsPerDay';

const METRIC_PERIOD: Record<UsageMetric, UsagePeriod> = {
  exportsPerMonth: 'monthly',
  aiCredits: 'monthly',
  keywordLookupsPerDay: 'daily',
};

/** Subscription statuses that grant the paid plan */
const PAID_STATUSES = ['active', 'trialing'] as const;
const PLAN_RANK: Record<Plan, number> = { free: 0, pro: 1, enterprise: 2 };

function planForPrice(priceId: string | null): Plan {
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_ENTERPRISE) return 'enterprise';
  if (priceId && priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  return 'free';
}

/**
 * Organization's current plan: the best plan among its active or trialing
 * subscriptions. Past-due, unpaid, and canceled subscriptions fall back to free.
 */
export async function getOrgPlan(orgId: string): Promise<Plan> {
  const active = await db
    .select({ priceId: subscriptions.stripePriceId })
    .from(subscriptions)
    .where(and(eq(subscriptions.orgId, orgId), inArray(subscriptions.status, [...PAID_STATUSES])));

  return active
    .map((s) => planForPrice(s.priceId))
    .reduce<Plan>((best, plan) => (PLAN_RANK[plan] > PLAN_RANK[best] ? plan : best), 'free');
}

export interface UsageResult {
  allowed: boolean;
  used: number;
  /** -1 means unlimited */
  limit: number;
  resetsAt: Date;
}

function usageKey(orgId: string, metric: UsageMetric, now = new Date()) {
  const period = METRIC_PERIOD[metric];
  return { orgId, metric, period, periodStart: usagePeriodStart(period, now), resetsAt: usagePeriodEnd(period, now) };
}

const sameUsageRow = (key: ReturnType<typeof usageKey>) =>
  and(
    eq(entitlementsUsage.orgId, key.orgId),
    eq(entitlementsUsage.metric, key.metric),
    eq(entitlementsUsage.period, key.period),
    eq(entitlementsUsage.periodStart, key.periodStart)
  );

/**
 * Atomically use `amount` of a metric if it stays within the plan limit.
 *
 * The check and the increment are one SQL statement, so concurrent requests
 * can't both slip under the limit. Call releaseUsage() if the action fails
 * after usage was consumed.
 */
export async function consumeUsage(orgId: string, metric: UsageMetric, amount = 1): Promise<UsageResult> {
  const limit = PLAN_LIMITS[await getOrgPlan(orgId)][metric];
  const key = usageKey(orgId, metric);
  const { resetsAt, ...row } = key;

  if (limit !== -1 && amount > limit) {
    return { allowed: false, used: await getUsed(key), limit, resetsAt };
  }

  const updated = await db
    .insert(entitlementsUsage)
    .values({ ...row, count: amount })
    .onConflictDoUpdate({
      target: [entitlementsUsage.orgId, entitlementsUsage.metric, entitlementsUsage.period, entitlementsUsage.periodStart],
      set: { count: sql`${entitlementsUsage.count} + ${amount}`, updatedAt: new Date() },
      // Only increment while it stays within the limit; otherwise no row comes back
      setWhere: limit === -1 ? undefined : sql`${entitlementsUsage.count} + ${amount} <= ${limit}`,
    })
    .returning({ count: entitlementsUsage.count });

  if (updated.length === 0) {
    return { allowed: false, used: await getUsed(key), limit, resetsAt };
  }
  return { allowed: true, used: updated[0].count, limit, resetsAt };
}

/**
 * Give back usage consumed for an action that didn't happen
 */
export async function releaseUsage(orgId: string, metric: UsageMetric, amount = 1) {
  await db
    .update(entitlementsUsage)
    .set({ count: sql`greatest(${entitlementsUsage.count} - ${amount}, 0)`, updatedAt: new Date() })
    .where(sameUsageRow(usageKey(orgId, metric)));
}

/**
 * Current usage without consuming any
 */
export async function getUsage(orgId: string, metric: UsageMetric): Promise<UsageResult> {
  const limit = PLAN_LIMITS[await getOrgPlan(orgId)][metric];
  const key = usageKey(orgId, metric);
  const used = await getUsed(key);
  return { allowed: limit === -1 || used < limit, used, limit, resetsAt: key.resetsAt };
}

async function getUsed(key: ReturnType<typeof usageKey>): Promise<number> {
  const [row] = await db.select({ count: entitlementsUsage.count }).from(entitlementsUsage).where(sameUsageRow(key)).limit(1);
  return row?.count ?? 0;
}
