import Stripe from 'stripe';

let stripe: Stripe | undefined;

export class BillingNotConfiguredError extends Error {
  constructor() {
    super('Billing is not configured');
  }
}

/** Prices for the paid plans, from STRIPE_PRICE_ID_* */
export const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_ID_PRO || null,
  enterprise: process.env.STRIPE_PRICE_ID_ENTERPRISE || null,
} as const;

export function isBillingConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY && !!(PLAN_PRICES.pro || PLAN_PRICES.enterprise);
}

/**
 * Stripe client, created on first use so the app runs without Stripe configured
 */
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new BillingNotConfiguredError();
  stripe ??= new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
  return stripe;
}
