'use client';

import { useState } from 'react';
import { MailWarningIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';

export function VerifyEmailBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);

  const resend = async () => {
    setSending(true);
    try {
      const result = await apiFetch<{ alreadyVerified?: boolean }>('/api/account/verify-email/resend', { method: 'POST' });
      toast.success(result.alreadyVerified ? 'Your email is already verified' : `Verification link sent to ${email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send the email');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <MailWarningIcon className="size-4 shrink-0" />
      <span className="flex-1">Please verify your email address ({email}). Check your inbox for the link.</span>
      <Button variant="outline" size="sm" disabled={sending} onClick={resend}>
        Resend link
      </Button>
    </div>
  );
}
