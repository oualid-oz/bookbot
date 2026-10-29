import Stripe from 'stripe';
import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, memberships, organizations } from '@bookbot/db';
import { GET as billingSummary } from '@/app/api/billing/route';
import { POST as checkout } from '@/app/api/billing/checkout/route';
import { POST as portal } from '@/app/api/billing/portal/route';
import { POST as webhook } from '@/app/api/webhooks/stripe/route';
import { createUser, json, request, resetDatabase, signInAs, type TestUser } from './helpers';

let owner: TestUser;
let member: TestUser;
const stripe = new Stripe('sk_test_dummy_for_tests');
const T = 1_761_800_000;

beforeAll(async () => {
  await resetDatabase();
  owner = await createUser('Owner');
  member = await createUser('Member');
  await db.insert(memberships).values({ userId: member.id, orgId: owner.orgId, role: 'member' });
});

/** Deliver a subscription event signed exactly as Stripe would */
function sendEvent(type: string, created: number, sub: Record<string, unknown>, secret = 'whsec_test_secret') {
  const payload = JSON.stringify({
    id: `evt_${type}_${created}`,
    object: 'event',
    type,
    created,
    data: {
      object: {
        id: 'sub_test',
        object: 'subscription',
        customer: 'cus_test',
        metadata: { orgId: owner.orgId },
        status: 'active',
        cancel_at_period_end: false,
        current_period_start: T,
        current_period_end: T + 30 * 86400,
        items: { data: [{ price: { id: 'price_test_pro' } }] },
        ...sub,
      },
    },
  });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  return webhook(new Request('http://localhost/api/webhooks/stripe', { method: 'POST', body: payload, headers: { 'stripe-signature': signature } }));
}

async function currentPlan() {
  signInAs(owner);
  return (await json<{ plan: string }>(await billingSummary(request('/api/billing')))).plan;
}

const price = (id: string) => ({ items: { data: [{ price: { id } }] } });

describe('stripe webhook', () => {
  it('rejects unsigned or wrongly signed events', async () => {
    const unsigned = await webhook(new Request('http://localhost/x', { method: 'POST', body: '{}' }));
    expect(unsigned.status).toBe(400);
    expect((await sendEvent('customer.subscription.created', T, {}, 'whsec_wrong')).status).toBe(400);
  });

  it('follows the subscription lifecycle and ignores late events', async () => {
    expect(await currentPlan()).toBe('free');

    expect((await sendEvent('customer.subscription.created', T, {})).status).toBe(200);
    expect(await currentPlan()).toBe('pro');
    const [org] = await db.select().from(organizations).where(eq(organizations.id, owner.orgId));
    expect(org.stripeCustomerId).toBe('cus_test');

    await sendEvent('customer.subscription.updated', T + 10, price('price_test_enterprise'));
    expect(await currentPlan()).toBe('enterprise');

    // Older event delivered late must not undo the upgrade
    await sendEvent('customer.subscription.updated', T + 5, { status: 'canceled' });
    expect(await currentPlan()).toBe('enterprise');

    // No metadata: found through the org's customer ID
    await sendEvent('customer.subscription.updated', T + 20, { metadata: {}, status: 'past_due', ...price('price_test_enterprise') });
    expect(await currentPlan()).toBe('free');

    await sendEvent('customer.subscription.deleted', T + 30, { status: 'canceled', ...price('price_test_enterprise') });
    expect(await currentPlan()).toBe('free');
  });

  it('acknowledges events for unknown customers', async () => {
    const res = await sendEvent('customer.subscription.created', T + 40, { id: 'sub_orphan', customer: 'cus_unknown', metadata: {} });
    expect(res.status).toBe(200);
  });
});

describe('checkout and portal', () => {
  const startCheckout = (body: unknown) => checkout(request('/api/billing/checkout', { method: 'POST', body }));

  it('is limited to owners and admins', async () => {
    signInAs(member);
    const res = await startCheckout({ plan: 'pro', orgId: owner.orgId });
    expect(res.status).toBe(403);
    const summary = await json<{ canManage: boolean }>(await billingSummary(request(`/api/billing?orgId=${owner.orgId}`)));
    expect(summary.canManage).toBe(false);
  });

  it('sends existing subscribers to the portal instead of a second checkout', async () => {
    signInAs(owner);
    await sendEvent('customer.subscription.created', T + 100, { id: 'sub_active', status: 'active' });
    expect((await startCheckout({ plan: 'enterprise' })).status).toBe(409);
  });

  it('needs a billing account before opening the portal', async () => {
    const newcomer = await createUser('Newcomer');
    signInAs(newcomer);
    expect((await portal(request('/api/billing/portal', { method: 'POST' }))).status).toBe(409);
  });

  it('reports when billing is not configured', async () => {
    const key = process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_SECRET_KEY;
    try {
      const newcomer = await createUser('Unconfigured');
      signInAs(newcomer);
      expect((await startCheckout({ plan: 'pro' })).status).toBe(503);
      expect((await json(await billingSummary(request('/api/billing')))).billingConfigured).toBe(false);
    } finally {
      process.env.STRIPE_SECRET_KEY = key;
    }
  });
});
