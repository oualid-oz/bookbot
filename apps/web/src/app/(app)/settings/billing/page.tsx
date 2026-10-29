'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CreditCardIcon, ExternalLinkIcon, Loader2Icon, SparklesIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';

type Plan = 'free' | 'pro' | 'enterprise';

interface Meter {
  used: number;
  limit: number;
  resetsAt?: string;
}

interface BillingInfo {
  plan: Plan;
  canManage: boolean;
  billingConfigured: boolean;
  availablePlans: Exclude<Plan, 'free'>[];
  subscription: { status: string; cancelAtPeriodEnd: boolean; currentPeriodEnd: string | null } | null;
  usage: Record<'exportsPerMonth' | 'keywordLookupsPerDay' | 'aiCredits' | 'projects', Meter>;
}

const PLAN_NAMES: Record<Plan, string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

const METERS = [
  { key: 'exportsPerMonth', label: 'Exports this month' },
  { key: 'keywordLookupsPerDay', label: 'Keyword lookups today' },
  { key: 'aiCredits', label: 'AI credits this month' },
  { key: 'projects', label: 'Projects' },
] as const;

export default function BillingPage() {
  const [info, setInfo] = useState<BillingInfo | null>(null);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState<string | null>(null);

  useEffect(() => {
    // Returning from Stripe Checkout
    const checkout = new URLSearchParams(window.location.search).get('checkout');
    if (checkout === 'success') toast.success('Thanks! Your plan updates as soon as Stripe confirms the payment.');
    if (checkout === 'canceled') toast.info('Checkout canceled. Nothing was charged.');

    apiFetch<BillingInfo>('/api/billing')
      .then(setInfo)
      .catch((err) => setError(err.message));
  }, []);

  // Checkout and portal both hand off to a Stripe-hosted page
  const goToStripe = async (action: string, url: string, body?: unknown) => {
    setRedirecting(action);
    try {
      const { url: target } = await apiFetch<{ url: string }>(url, { method: 'POST', body });
      window.location.assign(target);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not reach billing');
      setRedirecting(null);
    }
  };

  if (error) return <p className="mx-auto w-full max-w-4xl text-sm text-destructive">{error}</p>;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground">Your plan and this period&apos;s usage.</p>
      </div>

      {!info ? (
        <>
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </>
      ) : (
        <>
          {!info.billingConfigured && (
            <Alert>
              <CreditCardIcon />
              <AlertTitle>Billing isn&apos;t set up yet</AlertTitle>
              <AlertDescription>
                Add STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and the STRIPE_PRICE_ID_* values to enable upgrades.
              </AlertDescription>
            </Alert>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
              <CardDescription>{describeSubscription(info)}</CardDescription>
              <CardAction>
                <Badge variant={info.plan === 'free' ? 'secondary' : 'default'}>{PLAN_NAMES[info.plan]}</Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex flex-wrap gap-2 border-t pt-4">
              {info.subscription && info.subscription.status !== 'canceled' ? (
                <Button
                  variant="outline"
                  disabled={!info.canManage || !info.billingConfigured || redirecting !== null}
                  onClick={() => goToStripe('portal', '/api/billing/portal')}
                >
                  {redirecting === 'portal' ? <Loader2Icon className="animate-spin" /> : <ExternalLinkIcon />}
                  Manage billing
                </Button>
              ) : (
                info.availablePlans.map((plan) => (
                  <Button
                    key={plan}
                    variant={plan === 'pro' ? 'default' : 'outline'}
                    disabled={!info.canManage || !info.billingConfigured || redirecting !== null}
                    onClick={() => goToStripe(plan, '/api/billing/checkout', { plan })}
                  >
                    {redirecting === plan ? <Loader2Icon className="animate-spin" /> : <SparklesIcon />}
                    Upgrade to {PLAN_NAMES[plan]}
                  </Button>
                ))
              )}
              <Button variant="ghost" asChild>
                <Link href="/pricing">Compare plans</Link>
              </Button>
              {!info.canManage && (
                <p className="w-full text-sm text-muted-foreground">Only owners and admins can change the plan.</p>
              )}
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Usage</CardTitle>
              <CardDescription>Limits reset at midnight UTC (daily) and on the 1st (monthly).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              {METERS.map(({ key, label }) => {
                const meter = info.usage[key];
                const unlimited = meter.limit === -1;
                const percent = unlimited ? 0 : Math.min(100, (meter.used / Math.max(meter.limit, 1)) * 100);
                return (
                  <div key={key} className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{label}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {meter.used.toLocaleString()} / {unlimited ? 'Unlimited' : meter.limit.toLocaleString()}
                      </span>
                    </div>
                    <Progress value={percent} aria-label={label} className={percent >= 100 ? '[&>*]:bg-destructive' : undefined} />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function describeSubscription({ plan, subscription }: BillingInfo): string {
  if (!subscription || plan === 'free') {
    return subscription?.status === 'past_due'
      ? 'Your last payment failed. Update your payment method to restore your plan.'
      : 'You are on the free plan.';
  }
  const end = subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : null;
  if (subscription.cancelAtPeriodEnd) return end ? `Cancels on ${end}.` : 'Cancels at the end of the period.';
  if (subscription.status === 'trialing') return end ? `Trial ends on ${end}.` : 'Trial in progress.';
  return end ? `Renews on ${end}.` : 'Active.';
}
