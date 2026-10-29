import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { syncSubscription } from '@/server/billing';
import { getStripe } from '@/server/stripe';

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode !== 'subscription' || !session.subscription) break;
      // The session only carries the subscription ID; fetch the full object
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await logSync(event, subscription);
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await logSync(event, event.data.object);
      break;

    default:
      console.log(`Unhandled Stripe event type: ${event.type}`);
  }

  // Acknowledge everything we didn't fail on, so Stripe doesn't retry for days
  return NextResponse.json({ received: true });
}

async function logSync(event: Stripe.Event, subscription: Stripe.Subscription) {
  const result = await syncSubscription(subscription, event.created);
  if (result === 'no-org') {
    console.error(`Stripe ${event.type} ${event.id}: no organization for subscription ${subscription.id}`);
  } else if (result === 'stale') {
    console.log(`Stripe ${event.type} ${event.id}: older than the stored state, ignored`);
  }
}
