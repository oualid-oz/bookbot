import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth';
import { ensureStripeCustomer, getPaidSubscription } from '@/server/billing';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';
import { PLAN_PRICES, getStripe, isBillingConfigured } from '@/server/stripe';

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'enterprise']),
  orgId: z.string().uuid().optional(),
});

/**
 * Start a Stripe Checkout session for a paid plan
 */
export async function POST(req: NextRequest) {
  const parsed = checkoutSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  // Only owners and admins can change what the organization pays for
  const access = await requireOrgAccess(parsed.data.orgId, 'admin');
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  const priceId = PLAN_PRICES[parsed.data.plan];
  if (!isBillingConfigured() || !priceId) {
    return errorResponse(503, 'Billing is not configured');
  }

  // Plan changes for existing subscribers go through the portal, which
  // prorates; a second checkout would create a second subscription
  if (await getPaidSubscription(orgId)) {
    return errorResponse(409, 'Organization already has a subscription; use the billing portal to change plans');
  }

  const user = await getCurrentUser();
  const customer = await ensureStripeCustomer(orgId, user?.email);
  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;

  const session = await getStripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: orgId,
    metadata: { orgId },
    // Lets the webhook find the org from any later subscription event
    subscription_data: { metadata: { orgId } },
    allow_promotion_codes: true,
    success_url: `${baseUrl}/settings/billing?checkout=success`,
    cancel_url: `${baseUrl}/settings/billing?checkout=canceled`,
  });

  return NextResponse.json({ url: session.url });
}
