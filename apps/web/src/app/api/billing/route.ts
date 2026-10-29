import { NextRequest, NextResponse } from 'next/server';
import { PLAN_LIMITS, getOrgPlan, getUsage } from '@/lib/entitlements';
import { getDisplaySubscription } from '@/server/billing';
import { requireOrgAccess } from '@/server/org-access';
import { countProjects } from '@/server/projects';
import { PLAN_PRICES, isBillingConfigured } from '@/server/stripe';

/**
 * Current plan, subscription, and usage for the billing page
 */
export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;
  const { orgId, role } = access.value;

  const [plan, subscription, exports, keywords, aiCredits, projects] = await Promise.all([
    getOrgPlan(orgId),
    getDisplaySubscription(orgId),
    getUsage(orgId, 'exportsPerMonth'),
    getUsage(orgId, 'keywordLookupsPerDay'),
    getUsage(orgId, 'aiCredits'),
    countProjects(orgId),
  ]);

  return NextResponse.json({
    plan,
    canManage: role === 'owner' || role === 'admin',
    billingConfigured: isBillingConfigured(),
    availablePlans: (Object.keys(PLAN_PRICES) as (keyof typeof PLAN_PRICES)[]).filter((p) => PLAN_PRICES[p]),
    subscription: subscription && {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      currentPeriodEnd: subscription.currentPeriodEnd,
    },
    usage: {
      exportsPerMonth: exports,
      keywordLookupsPerDay: keywords,
      aiCredits,
      projects: { used: projects, limit: PLAN_LIMITS[plan].projects },
    },
  });
}
