'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { ApiError, apiFetch } from '@/lib/api-client';

/** A single name field saved with PATCH { name } */
export function NameForm({ id, label, url, initial, disabled }: {
  id: string;
  label: string;
  url: string;
  initial: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      await apiFetch(url, { method: 'PATCH', body: { name } });
      setSaved(name.trim());
      setName(name.trim());
      toast.success(`${label} saved`);
      // The sidebar shows the name from the server
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.name?.[0] ?? err.message) : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <Field data-invalid={!!error}>
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
        <div className="flex gap-2">
          <Input id={id} value={name} maxLength={255} disabled={disabled} aria-invalid={!!error}
            onChange={(e) => setName(e.target.value)} />
          {!disabled && (
            <Button type="submit" variant="outline" disabled={saving || !name.trim() || name.trim() === saved}>
              {saving && <Loader2Icon className="animate-spin" />}
              Save
            </Button>
          )}
        </div>
        {error && <FieldError>{error}</FieldError>}
      </Field>
    </form>
  );
}
