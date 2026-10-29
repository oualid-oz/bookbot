import { NextRequest, NextResponse } from 'next/server';
import { getOrgCustomerId } from '@/server/billing';
import { errorResponse, requireOrgAccess } from '@/server/org-access';
import { getStripe, isBillingConfigured } from '@/server/stripe';

/**
 * Open the Stripe customer portal (change plan, payment method, invoices, cancel)
 */
export async function POST(req: NextRequest) {
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'), 'admin');
  if (!access.ok) return access.response;

  if (!isBillingConfigured()) {
    return errorResponse(503, 'Billing is not configured');
  }

  const customer = await getOrgCustomerId(access.value.orgId);
  if (!customer) {
    return errorResponse(409, 'No billing account yet; subscribe to a plan first');
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? req.nextUrl.origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer,
    return_url: `${baseUrl}/settings/billing`,
  });

  return NextResponse.json({ url: session.url });
}
