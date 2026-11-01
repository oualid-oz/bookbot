'use client';

import { useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { PASSWORD_MIN_LENGTH } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api-client';

type Fields = Partial<Record<'currentPassword' | 'newPassword', string[]>>;

const toErrors = (messages?: string[]) => messages?.map((message) => ({ message }));

export function PasswordCard({ hasPassword, onChanged }: { hasPassword: boolean; onChanged: () => void }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [fields, setFields] = useState<Fields>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFields({});
    try {
      await apiFetch('/api/account/password', {
        method: 'POST',
        body: { currentPassword: hasPassword ? currentPassword : undefined, newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      toast.success(hasPassword ? 'Password changed. Your other devices were signed out.' : 'Password set. You can now sign in with your email.');
      onChanged();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) setFields(err.fields);
      else toast.error(err instanceof Error ? err.message : 'Could not change the password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{hasPassword ? 'Password' : 'Set a password'}</CardTitle>
        <CardDescription>
          {hasPassword
            ? 'Changing it signs you out on every other device.'
            : 'You sign in with Google. Add a password to also sign in with your email.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate>
          <FieldGroup>
            {hasPassword && (
              <Field data-invalid={!!fields.currentPassword}>
                <FieldLabel htmlFor="current-password">Current password</FieldLabel>
                <Input id="current-password" type="password" autoComplete="current-password"
                  aria-invalid={!!fields.currentPassword} value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)} />
                <FieldError errors={toErrors(fields.currentPassword)} />
              </Field>
            )}
            <Field data-invalid={!!fields.newPassword}>
              <FieldLabel htmlFor="new-password">New password</FieldLabel>
              <Input id="new-password" type="password" autoComplete="new-password"
                aria-invalid={!!fields.newPassword} value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)} />
              {fields.newPassword ? (
                <FieldError errors={toErrors(fields.newPassword)} />
              ) : (
                <FieldDescription>At least {PASSWORD_MIN_LENGTH} characters</FieldDescription>
              )}
            </Field>
            <Field orientation="horizontal">
              <Button type="submit" disabled={saving || !newPassword || (hasPassword && !currentPassword)}>
                {saving && <Loader2Icon className="animate-spin" />}
                {hasPassword ? 'Change password' : 'Set password'}
              </Button>
            </Field>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
