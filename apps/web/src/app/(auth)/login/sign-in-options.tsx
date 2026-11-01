'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { AuthLink } from '@/components/auth-link';
import { getCallbackUrl } from '@/lib/callback-url';

interface ProviderInfo {
  id: string;
  name: string;
  type: string;
}


export function SignInOptions({ providers }: { providers: ProviderInfo[] }) {
  const passwordProvider = providers.find((p) => p.id === 'password');
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

      <FieldDescription className="text-center">
        Don&apos;t have an account? <AuthLink href="/signup">Sign up</AuthLink>
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
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link href="/forgot-password" className="ml-auto text-sm underline-offset-4 hover:underline">
              Forgot password?
            </Link>
          </div>
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
