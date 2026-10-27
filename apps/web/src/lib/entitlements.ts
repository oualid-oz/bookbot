import { eq, and, sql } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { subscriptions, entitlementsUsage, organizations } from '@bookbot/db/schema';

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

/**
 * Get organization's subscription plan
 */
export async function getOrgPlan(orgId: string) {
  const subscription = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .limit(1);

  if (!subscription[0] || subscription[0].status === 'canceled') {
    return 'free';
  }

  // Determine plan from Stripe price ID
  const priceId = subscription[0].stripePriceId;
  if (priceId === process.env.STRIPE_PRICE_ID_PRO) return 'pro';
  if (priceId === process.env.STRIPE_PRICE_ID_ENTERPRISE) return 'enterprise';
  return 'free';
}

/**
 * Check if organization has entitlement for a metric
 * Returns true if within limits, false if exceeded
 */
export async function checkEntitlement(
  orgId: string,
  metric: 'exportsPerMonth' | 'aiCredits' | 'keywordLookupsPerDay' | 'projects'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await getOrgPlan(orgId);
  const limit = PLAN_LIMITS[plan][metric];

  // Unlimited
  if (limit === -1) {
    return { allowed: true, used: 0, limit: -1 };
  }

  // Calculate period start
  const now = new Date();
  const periodStart = metric === 'keywordLookupsPerDay'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const period = metric === 'keywordLookupsPerDay' ? 'daily' : 'monthly';

  // Get current usage
  const usage = await db
    .select({ count: entitlementsUsage.count })
    .from(entitlementsUsage)
    .where(
      and(
        eq(entitlementsUsage.orgId, orgId),
        eq(entitlementsUsage.metric, metric),
        eq(entitlementsUsage.period, period),
        eq(entitlementsUsage.periodStart, periodStart)
      )
    )
    .limit(1);

  const used = usage[0]?.count || 0;
  const allowed = used < limit;

  return { allowed, used, limit };
}

/**
 * Increment usage for a metric
 */
export async function incrementUsage(
  orgId: string,
  metric: 'exportsPerMonth' | 'aiCredits' | 'keywordLookupsPerDay' | 'projects'
) {
  const now = new Date();
  const periodStart = metric === 'keywordLookupsPerDay'
    ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
    : new Date(now.getFullYear(), now.getMonth(), 1);

  const period = metric === 'keywordLookupsPerDay' ? 'daily' : 'monthly';

  // Check if usage record exists
  const existing = await db
    .select()
    .from(entitlementsUsage)
    .where(
      and(
        eq(entitlementsUsage.orgId, orgId),
        eq(entitlementsUsage.metric, metric),
        eq(entitlementsUsage.period, period),
        eq(entitlementsUsage.periodStart, periodStart)
      )
    )
    .limit(1);

  if (existing[0]) {
    // Update existing
    await db
      .update(entitlementsUsage)
      .set({
        count: sql`${entitlementsUsage.count} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(entitlementsUsage.id, existing[0].id));
  } else {
    // Create new
    await db.insert(entitlementsUsage).values({
      orgId,
      metric,
      period,
      periodStart,
      count: 1,
    });
  }
}
