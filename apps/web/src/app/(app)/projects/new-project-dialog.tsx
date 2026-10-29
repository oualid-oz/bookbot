'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2Icon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MAX_PAGE_COUNT, MIN_PAGE_COUNT, PROJECT_TYPES, type ProjectCreateInput } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, apiFetch } from '@/lib/api-client';
import { PAPER_LABELS, PROJECT_TYPE_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';

type Errors = Record<string, string[] | undefined>;

const INITIAL: ProjectCreateInput = { title: '', subtitle: '', type: 'puzzle_book', trimSize: '6x9', pageCount: 100, paper: 'white' };

export function NewProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<ProjectCreateInput>(INITIAL);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof ProjectCreateInput>(key: K, value: ProjectCreateInput[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      const { project } = await apiFetch<{ project: ProjectSummary }>('/api/projects', { method: 'POST', body: values });
      setOpen(false);
      setValues(INITIAL);
      router.push(`/projects/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else toast.error(err instanceof Error ? err.message : 'Could not create project');
    } finally {
      setSaving(false);
    }
  };

  const toErrors = (key: string) => errors[key]?.map((message) => ({ message }));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon />
          New project
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>Set up the book. You can change these later.</DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field data-invalid={!!errors.title}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input id="title" value={values.title} aria-invalid={!!errors.title}
                onChange={(e) => set('title', e.target.value)} placeholder="Animal Word Search" />
              <FieldError errors={toErrors('title')} />
            </Field>

            <Field>
              <FieldLabel htmlFor="subtitle">Subtitle</FieldLabel>
              <Input id="subtitle" value={values.subtitle ?? ''} onChange={(e) => set('subtitle', e.target.value)} />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <FieldLabel htmlFor="type">Type</FieldLabel>
                <Select value={values.type} onValueChange={(v) => set('type', v as ProjectCreateInput['type'])}>
                  <SelectTrigger id="type" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{PROJECT_TYPE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="trim">Trim size</FieldLabel>
                <Select value={values.trimSize} onValueChange={(v) => set('trimSize', v)}>
                  <SelectTrigger id="trim" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TRIM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field data-invalid={!!errors.pageCount}>
                <FieldLabel htmlFor="pages">Pages</FieldLabel>
                <Input id="pages" type="number" min={MIN_PAGE_COUNT} max={MAX_PAGE_COUNT}
                  value={values.pageCount} aria-invalid={!!errors.pageCount}
                  onChange={(e) => set('pageCount', Number(e.target.value) || 0)} />
                <FieldError errors={toErrors('pageCount')} />
              </Field>
              <Field>
                <FieldLabel htmlFor="paper">Paper</FieldLabel>
                <Select value={values.paper} onValueChange={(v) => set('paper', v as ProjectCreateInput['paper'])}>
                  <SelectTrigger id="paper" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAPER_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>

          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2Icon className="animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
