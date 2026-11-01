'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2Icon, Loader2Icon, LogOutIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { DeleteAccountCard } from './delete-account-card';
import { NameForm } from './name-form';
import { PasswordCard } from './password-card';

interface Account {
  name: string | null;
  email: string;
  emailVerified: boolean;
  hasPassword: boolean;
}

interface Org {
  id: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
}

export default function AccountSettingsPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [org, setOrg] = useState<Org | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const loadAccount = () => apiFetch<Account>('/api/account').then(setAccount);

  useEffect(() => {
    Promise.all([loadAccount(), apiFetch<{ orgs: Org[] }>('/api/orgs').then((data) => setOrg(data.orgs[0] ?? null))])
      .catch((err) => setError(err.message));
  }, []);

  const resendVerification = async () => {
    setSending(true);
    try {
      await apiFetch('/api/account/verify-email/resend', { method: 'POST' });
      toast.success(`Verification link sent to ${account?.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setSending(false);
    }
  };

  const signOutOthers = async () => {
    setSigningOut(true);
    try {
      await apiFetch('/api/account/sessions', { method: 'DELETE' });
      toast.success('Signed out on all other devices');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not sign out other devices');
    } finally {
      setSigningOut(false);
    }
  };

  if (error) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Account</h1>
        <p className="text-muted-foreground">Your profile, sign-in and workspace.</p>
      </div>

      {!account ? (
        <>
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
              <CardDescription>How you appear in Bookbot.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <NameForm id="name" label="Name" url="/api/account" initial={account.name ?? ''} />
                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <div className="flex items-center gap-2">
                    <Input id="email" value={account.email} readOnly disabled />
                    {account.emailVerified ? (
                      <Badge variant="secondary"><CheckCircle2Icon />Verified</Badge>
                    ) : (
                      <Button variant="outline" disabled={sending} onClick={resendVerification}>
                        {sending && <Loader2Icon className="animate-spin" />}
                        Verify
                      </Button>
                    )}
                  </div>
                </Field>
              </FieldGroup>
            </CardContent>
          </Card>

          {org && (
            <Card>
              <CardHeader>
                <CardTitle>Workspace</CardTitle>
                <CardDescription>Your projects, research and plan belong to this workspace.</CardDescription>
              </CardHeader>
              <CardContent>
                <FieldGroup>
                  <NameForm id="workspace-name" label="Workspace name" url={`/api/orgs/${org.id}`}
                    initial={org.name} disabled={org.role === 'member'} />
                  {org.role === 'member' && <FieldDescription>Only admins can rename the workspace.</FieldDescription>}
                </FieldGroup>
              </CardContent>
            </Card>
          )}

          <PasswordCard hasPassword={account.hasPassword} onChanged={loadAccount} />

          <Card>
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>
                Signed in on a computer you no longer use? Sign out everywhere except this browser.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" disabled={signingOut} onClick={signOutOthers}>
                {signingOut ? <Loader2Icon className="animate-spin" /> : <LogOutIcon />}
                Sign out other devices
              </Button>
            </CardContent>
          </Card>

          <DeleteAccountCard email={account.email} hasPassword={account.hasPassword} />
        </>
      )}
    </div>
  );
}
