'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { AlertCircleIcon, Loader2Icon } from 'lucide-react';
import { signupSchema, PASSWORD_MIN_LENGTH, type SignupInput } from '@bookbot/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type FieldErrors = Partial<Record<keyof SignupInput, string[]>>;

export function SignupForm() {
  const router = useRouter();
  const [values, setValues] = useState<SignupInput>({ name: '', email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = (field: keyof SignupInput) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues({ ...values, [field]: e.target.value });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const parsed = signupSchema.safeParse(values);
    if (!parsed.success) {
      setFieldErrors(parsed.error.flatten().fieldErrors);
      return;
    }
    setFieldErrors({});
    setLoading(true);

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json();

      if (!response.ok) {
        setFieldErrors(data.fields ?? {});
        setError(data.fields ? '' : data.error || 'Sign-up failed');
        return;
      }

      const result = await signIn('password', {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });
      if (result?.error) {
        // Account exists but automatic sign-in failed; let them sign in manually
        router.push('/login');
        return;
      }
      router.push('/research');
      router.refresh();
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toErrors = (messages?: string[]) => messages?.map((message) => ({ message }));

  return (
    <form onSubmit={handleSubmit} noValidate>
      <FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field data-invalid={!!fieldErrors.name}>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" type="text" autoComplete="name" aria-invalid={!!fieldErrors.name}
            value={values.name} onChange={update('name')} />
          <FieldError errors={toErrors(fieldErrors.name)} />
        </Field>

        <Field data-invalid={!!fieldErrors.email}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" type="email" autoComplete="email" placeholder="you@example.com"
            aria-invalid={!!fieldErrors.email} value={values.email} onChange={update('email')} />
          <FieldError errors={toErrors(fieldErrors.email)} />
        </Field>

        <Field data-invalid={!!fieldErrors.password}>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input id="password" type="password" autoComplete="new-password"
            aria-invalid={!!fieldErrors.password} value={values.password} onChange={update('password')} />
          {fieldErrors.password ? (
            <FieldError errors={toErrors(fieldErrors.password)} />
          ) : (
            <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters</FieldDescription>
          )}
        </Field>

        <Field>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2Icon className="animate-spin" />}
            {loading ? 'Creating account...' : 'Create account'}
          </Button>
          <FieldDescription className="text-center">
            Already have an account? <Link href="/login">Sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
