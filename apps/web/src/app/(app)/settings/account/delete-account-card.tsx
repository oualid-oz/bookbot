'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api-client';

export function DeleteAccountCard({ email, hasPassword }: { email: string; hasPassword: boolean }) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [fieldError, setFieldError] = useState<string>();
  const [error, setError] = useState<string>();

  const reset = (next: boolean) => {
    setOpen(next);
    setConfirmation('');
    setFieldError(undefined);
    setError(undefined);
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeleting(true);
    setFieldError(undefined);
    setError(undefined);
    try {
      await apiFetch('/api/account', {
        method: 'DELETE',
        body: hasPassword ? { password: confirmation } : { email: confirmation },
      });
      await signOut({ callbackUrl: '/login' });
    } catch (err) {
      const field = err instanceof ApiError ? (err.fields.password ?? err.fields.email)?.[0] : undefined;
      if (field) setFieldError(field);
      else setError(err instanceof Error ? err.message : 'Could not delete the account');
      setDeleting(false);
    }
  };

  const canSubmit = hasPassword ? !!confirmation : confirmation.trim().toLowerCase() === email;

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account, your workspace, and all its projects, exports and images.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Dialog open={open} onOpenChange={reset}>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete account</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleDelete} noValidate className="flex flex-col gap-4">
              <DialogHeader>
                <DialogTitle>Delete your account?</DialogTitle>
                <DialogDescription>
                  This can&apos;t be undone. Your projects, exports, images and saved research are deleted for good.
                </DialogDescription>
              </DialogHeader>

              {error && (
                <Alert variant="destructive">
                  <TriangleAlertIcon />
                  <AlertDescription>
                    {error}
                    {error.includes('subscription') && (
                      <Link href="/settings/billing" className="underline">Go to Billing</Link>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              <Field data-invalid={!!fieldError}>
                <FieldLabel htmlFor="delete-confirmation">
                  {hasPassword ? 'Enter your password to confirm' : `Type ${email} to confirm`}
                </FieldLabel>
                <Input id="delete-confirmation" type={hasPassword ? 'password' : 'text'}
                  autoComplete={hasPassword ? 'current-password' : 'off'} aria-invalid={!!fieldError}
                  value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
                {fieldError && <FieldError>{fieldError}</FieldError>}
              </Field>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">Cancel</Button>
                </DialogClose>
                <Button type="submit" variant="destructive" disabled={deleting || !canSubmit}>
                  {deleting && <Loader2Icon className="animate-spin" />}
                  Delete account
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
