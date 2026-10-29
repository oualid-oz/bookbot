'use client';

import { useEffect, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_PAGE_COUNT, MIN_PAGE_COUNT } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, apiFetch } from '@/lib/api-client';
import { PAPER_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';

export function DetailsCard({ project, onSaved }: { project: ProjectSummary; onSaved: (p: ProjectSummary) => void }) {
  const [values, setValues] = useState(project);
  const [errors, setErrors] = useState<Record<string, string[] | undefined>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => setValues(project), [project]);

  const set = <K extends keyof ProjectSummary>(key: K, value: ProjectSummary[K]) => setValues((v) => ({ ...v, [key]: value }));
  const dirty = (['title', 'subtitle', 'trimSize', 'pageCount', 'paper'] as const).some((k) => (values[k] ?? '') !== (project[k] ?? ''));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { project: saved } = await apiFetch<{ project: ProjectSummary }>(`/api/projects/${project.id}`, {
        method: 'PATCH',
        body: {
          title: values.title,
          subtitle: values.subtitle ?? '',
          trimSize: values.trimSize,
          pageCount: values.pageCount,
          paper: values.paper,
        },
      });
      onSaved(saved);
      toast.success('Book details saved');
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else toast.error(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  };

  const toErrors = (key: string) => errors[key]?.map((message) => ({ message }));

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-(--card-spacing)">
        <CardHeader>
          <CardTitle>Book details</CardTitle>
          <CardDescription>Used for the title page, cover size, and spine.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="d-title">Title</FieldLabel>
              <Input id="d-title" value={values.title} aria-invalid={!!errors.title} onChange={(e) => set('title', e.target.value)} />
              <FieldError errors={toErrors('title')} />
            </Field>
            <Field>
              <FieldLabel htmlFor="d-subtitle">Subtitle</FieldLabel>
              <Input id="d-subtitle" value={values.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="d-trim">Trim size</FieldLabel>
              <Select value={values.trimSize} onValueChange={(v) => set('trimSize', v)}>
                <SelectTrigger id="d-trim" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field data-invalid={!!errors.pageCount}>
                <FieldLabel htmlFor="d-pages">Pages</FieldLabel>
                <Input id="d-pages" type="number" min={MIN_PAGE_COUNT} max={MAX_PAGE_COUNT} value={values.pageCount}
                  aria-invalid={!!errors.pageCount} onChange={(e) => set('pageCount', Number(e.target.value) || 0)} />
                <FieldError errors={toErrors('pageCount')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="d-paper">Paper</FieldLabel>
                <Select value={values.paper} onValueChange={(v) => set('paper', v as ProjectSummary['paper'])}>
                  <SelectTrigger id="d-paper" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAPER_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end border-t pt-4">
          <Button type="submit" disabled={!dirty || saving}>
            {saving && <Loader2Icon className="animate-spin" />}
            Save changes
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
