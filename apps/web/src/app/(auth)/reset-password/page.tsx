'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2Icon, Loader2Icon } from 'lucide-react';
import { PASSWORD_MIN_LENGTH } from '@bookbot/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api-client';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const token = new URLSearchParams(window.location.search).get('token') ?? '';
      await apiFetch('/api/account/password-reset/confirm', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.password?.[0] ?? err.fields.token?.[0] ?? err.message) : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Choose a new password</CardTitle>
        <CardDescription>Then sign in with it.</CardDescription>
      </CardHeader>
      <CardContent>
        {done ? (
          <FieldGroup>
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>Password updated</AlertTitle>
              <AlertDescription>You can now sign in with your new password.</AlertDescription>
            </Alert>
            <Button asChild>
              <Link href="/login">Sign in</Link>
            </Button>
          </FieldGroup>
        ) : (
          <form onSubmit={handleSubmit}>
            <FieldGroup>
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="password">New password</FieldLabel>
                <Input id="password" type="password" required autoComplete="new-password" value={password}
                  aria-invalid={!!error} onChange={(e) => setPassword(e.target.value)} />
                {error ? <FieldError>{error}</FieldError> : <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters</FieldDescription>}
              </Field>
              <Field>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2Icon className="animate-spin" />}
                  Set password
                </Button>
                <FieldDescription className="text-center">
                  Link expired? <Link href="/forgot-password">Send a new one</Link>
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
