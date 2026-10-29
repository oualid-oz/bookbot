'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

interface ProviderInfo {
  id: string;
  name: string;
  type: string;
}

// The auth proxy sends users here with ?callbackUrl=<page they wanted>
function getCallbackUrl() {
  return new URLSearchParams(window.location.search).get('callbackUrl') || '/research';
}

export function SignInOptions({ providers }: { providers: ProviderInfo[] }) {
  const passwordProvider = providers.find((p) => p.id === 'password');
  const devProvider = providers.find((p) => p.id === 'dev-login');
  const oauthProviders = providers.filter((p) => p.type === 'oauth');

  return (
    <FieldGroup>
      {passwordProvider && <PasswordForm providerId={passwordProvider.id} />}

      {oauthProviders.length > 0 && (
        <>
          <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
            Or continue with
          </FieldSeparator>
          <Field>
            {oauthProviders.map((provider) => (
              <Button
                key={provider.id}
                type="button"
                variant="outline"
                onClick={() => signIn(provider.id, { callbackUrl: getCallbackUrl() })}
              >
                Continue with {provider.name}
              </Button>
            ))}
          </Field>
        </>
      )}

      {devProvider && <DevLoginForm providerId={devProvider.id} name={devProvider.name} />}

      <FieldDescription className="text-center">
        Don&apos;t have an account? <Link href="/signup">Sign up</Link>
      </FieldDescription>
    </FieldGroup>
  );
}

function PasswordForm({ providerId }: { providerId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn(providerId, { email, password, redirect: false });
      if (result?.error) {
        setError('Incorrect email or password');
        return;
      }
      router.push(getCallbackUrl());
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" required autoComplete="email" placeholder="you@example.com"
            value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" required autoComplete="current-password"
            value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" />}
            {loading ? 'Signing in...' : 'Sign in'}
          </Button>
        </Field>
      </FieldGroup>
    </form>
  );
}

function DevLoginForm({ providerId, name }: { providerId: string; name: string }) {
  const [email, setEmail] = useState('');

  return (
    <>
      <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
        Development
      </FieldSeparator>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          signIn(providerId, { email, callbackUrl: getCallbackUrl() });
        }}
      >
        <Field>
          <FieldLabel htmlFor="dev-email">
            {name} <Badge variant="outline">dev only</Badge>
          </FieldLabel>
          <div className="flex gap-2">
            <Input id="dev-email" type="email" required placeholder="you@example.com"
              value={email} onChange={(e) => setEmail(e.target.value)} />
            <Button type="submit" variant="secondary">Sign in</Button>
          </div>
          <FieldDescription>Passwordless login, only available under next dev.</FieldDescription>
        </Field>
      </form>
    </>
  );
}
