import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/server/stripe';
import { db } from '@bookbot/db';
import { organizations, subscriptions } from '@bookbot/db/schema';
import { eq } from 'drizzle-orm';
import { isUuid } from '@/server/org-access';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = (await headers()).get('stripe-signature')!;

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 400 }
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as any;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      const orgId = session.metadata?.orgId;

      // Checkout sessions must be created with metadata.orgId. Acknowledge bad
      // events instead of failing, since Stripe would retry them for days.
      const [org] = isUuid(orgId)
        ? await db.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, orgId)).limit(1)
        : [];
      if (!org) {
        console.error(`Stripe checkout ${session.id} has missing or unknown metadata.orgId`);
        break;
      }

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      const values = {
        stripeCustomerId: customerId,
        stripePriceId: subscription.items.data[0].price.id,
        status: subscription.status as any,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      };

      // Stripe can deliver the same event more than once
      await db
        .insert(subscriptions)
        .values({ orgId: org.id, stripeSubscriptionId: subscriptionId, ...values })
        .onConflictDoUpdate({
          target: subscriptions.stripeSubscriptionId,
          set: { ...values, updatedAt: new Date() },
        });

      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as any;

      await db
        .update(subscriptions)
        .set({
          status: subscription.status as any,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

      break;
    }

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}
