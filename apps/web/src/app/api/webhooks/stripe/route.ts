import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import { stripe } from '@/server/stripe';
import { db } from '@bookbot/db';
import { subscriptions } from '@bookbot/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;

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

      const subscription = await stripe.subscriptions.retrieve(subscriptionId);

      await db.insert(subscriptions).values({
        orgId: session.metadata?.orgId || '',
        stripeSubscriptionId: subscriptionId,
        stripeCustomerId: customerId,
        stripePriceId: subscription.items.data[0].price.id,
        status: subscription.status as any,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
