'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2Icon, Loader2Icon, XCircleIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { apiFetch } from '@/lib/api-client';

export default function VerifyEmailPage() {
  const [state, setState] = useState<'verifying' | 'verified' | 'failed'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    apiFetch('/api/account/verify-email', { method: 'POST', body: { token } })
      .then(() => setState('verified'))
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Verification failed');
        setState('failed');
      });
  }, []);

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Email verification</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {state === 'verifying' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" /> Verifying…
            </div>
          )}
          {state === 'verified' && (
            <Alert>
              <CheckCircle2Icon />
              <AlertTitle>Email verified</AlertTitle>
              <AlertDescription>Thanks for confirming your address.</AlertDescription>
            </Alert>
          )}
          {state === 'failed' && (
            <Alert variant="destructive">
              <XCircleIcon />
              <AlertTitle>Couldn&apos;t verify</AlertTitle>
              <AlertDescription>{error} Sign in to send a new link.</AlertDescription>
            </Alert>
          )}
          {state !== 'verifying' && (
            <Button asChild>
              <Link href="/research">Continue to Bookbot</Link>
            </Button>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}
