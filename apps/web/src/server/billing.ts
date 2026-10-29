import type Stripe from 'stripe';
import { and, desc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { db, organizations, subscriptions } from '@bookbot/db';
import { getStripe } from './stripe';
import { isUuid } from './org-access';

type SubscriptionStatus = (typeof subscriptions.status.enumValues)[number];
const KNOWN_STATUSES = new Set<string>(subscriptions.status.enumValues);

/**
 * The org's Stripe customer, created the first time it's needed. The
 * idempotency key stops concurrent first checkouts creating two customers.
 */
export async function ensureStripeCustomer(orgId: string, email: string | null | undefined): Promise<string> {
  const [org] = await db
    .select({ name: organizations.name, customerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (org?.customerId) return org.customerId;

  const customer = await getStripe().customers.create(
    { name: org?.name, email: email ?? undefined, metadata: { orgId } },
    { idempotencyKey: `org-customer-${orgId}` }
  );
  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id, updatedAt: new Date() })
    .where(and(eq(organizations.id, orgId), isNull(organizations.stripeCustomerId)));
  return customer.id;
}

export async function getOrgCustomerId(orgId: string): Promise<string | null> {
  const [org] = await db
    .select({ customerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return org?.customerId ?? null;
}

/** The org's current active or trialing subscription, if any */
export async function getPaidSubscription(orgId: string) {
  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.orgId, orgId), inArray(subscriptions.status, ['active', 'trialing'])))
    .limit(1);
  return sub ?? null;
}

/**
 * Most relevant subscription to show: a paid one, else the most recent
 */
export async function getDisplaySubscription(orgId: string) {
  const paid = await getPaidSubscription(orgId);
  if (paid) return paid;
  const [latest] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(1);
  return latest ?? null;
}

/**
 * Apply a subscription from a Stripe event. The org comes from the
 * subscription metadata (set at checkout) or the org's customer ID. Events
 * older than the last one applied are ignored, since Stripe doesn't
 * guarantee delivery order.
 */
export async function syncSubscription(subscription: Stripe.Subscription, eventCreated: number): Promise<'applied' | 'stale' | 'no-org'> {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;
  const orgId = await resolveOrgId(subscription.metadata?.orgId, customerId);
  if (!orgId) return 'no-org';

  const eventAt = new Date(eventCreated * 1000);
  const values = {
    orgId,
    stripeCustomerId: customerId,
    stripePriceId: subscription.items.data[0]?.price.id ?? null,
    status: (KNOWN_STATUSES.has(subscription.status) ? subscription.status : 'unpaid') as SubscriptionStatus,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    stripeEventAt: eventAt,
    updatedAt: new Date(),
  };

  const applied = await db
    .insert(subscriptions)
    .values({ stripeSubscriptionId: subscription.id, ...values })
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: values,
      // Equal timestamps still apply: Stripe's `created` has 1s resolution
      setWhere: or(isNull(subscriptions.stripeEventAt), lte(subscriptions.stripeEventAt, eventAt)),
    })
    .returning({ id: subscriptions.id });

  // Remember the customer on the org so portal sessions and later events find it
  await db
    .update(organizations)
    .set({ stripeCustomerId: customerId, updatedAt: new Date() })
    .where(and(eq(organizations.id, orgId), isNull(organizations.stripeCustomerId)));

  return applied.length ? 'applied' : 'stale';
}

async function resolveOrgId(metadataOrgId: string | undefined, customerId: string): Promise<string | null> {
  if (isUuid(metadataOrgId)) {
    const [org] = await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, metadataOrgId)).limit(1);
    if (org) return org.id;
  }
  const [byCustomer] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.stripeCustomerId, customerId))
    .limit(1);
  return byCustomer?.id ?? null;
}
