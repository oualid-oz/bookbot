import Link from 'next/link';
import { CheckIcon } from 'lucide-react';
import { PLAN_LIMITS } from '@/lib/entitlements';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const PLAN_DESCRIPTIONS: Record<keyof typeof PLAN_LIMITS, string> = {
  free: 'Try Bookbot on a few books',
  pro: 'For active KDP publishers',
  enterprise: 'For teams and high volume',
};

function formatLimit(value: number) {
  return value === -1 ? 'Unlimited' : value.toLocaleString();
}

export default function PricingPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-semibold tracking-tight">Pricing</h1>
        <p className="text-muted-foreground">Pick the plan that fits your publishing volume.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {(Object.keys(PLAN_LIMITS) as (keyof typeof PLAN_LIMITS)[]).map((plan) => {
          const limits = PLAN_LIMITS[plan];
          const features = [
            `${formatLimit(limits.exportsPerMonth)} exports / month`,
            `${formatLimit(limits.aiCredits)} AI credits`,
            `${formatLimit(limits.keywordLookupsPerDay)} keyword lookups / day`,
            `${formatLimit(limits.projects)} projects`,
          ];

          return (
            <Card key={plan} className={plan === 'pro' ? 'ring-2 ring-primary' : undefined}>
              <CardHeader>
                <CardTitle className="capitalize">{plan}</CardTitle>
                <CardDescription>{PLAN_DESCRIPTIONS[plan]}</CardDescription>
                {plan === 'pro' && (
                  <CardAction>
                    <Badge>Popular</Badge>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="flex flex-col gap-2">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <CheckIcon className="size-4 text-muted-foreground" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full" variant={plan === 'pro' ? 'default' : 'outline'} asChild>
                  <Link href="/signup">Get started</Link>
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
