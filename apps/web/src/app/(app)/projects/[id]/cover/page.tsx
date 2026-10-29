'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeftIcon, CheckIcon, CloudAlertIcon, Loader2Icon } from 'lucide-react';
import { layoutCover } from '@bookbot/core';
import { coverDesignSchema, type CoverDesign } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import type { ProjectSummary } from '@/components/project-options';

// Konva requires the browser canvas, so skip server rendering
const CoverPreview = dynamic(() => import('./cover-preview'), {
  ssr: false,
  loading: () => <Skeleton className="aspect-[4/3] w-full" />,
});

type SaveState = 'idle' | 'saving' | 'saved' | 'error';
const SAVE_DELAY_MS = 800;

export default function CoverEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [design, setDesign] = useState<CoverDesign | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [error, setError] = useState('');
  const [previewWidth, setPreviewWidth] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pendingDesign = useRef<CoverDesign | null>(null);

  useEffect(() => {
    Promise.all([
      apiFetch<{ project: ProjectSummary }>(`/api/projects/${id}`),
      apiFetch<{ design: CoverDesign }>(`/api/projects/${id}/cover`),
    ])
      .then(([p, c]) => {
        setProject(p.project);
        setDesign(c.design);
      })
      .catch((err) => setError(err.message));
  }, [id]);

  // Fit the preview to its container
  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setPreviewWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [project]);

  // Send any pending save right away when leaving the page; keepalive lets the
  // request finish even after navigation
  useEffect(
    () => () => {
      clearTimeout(saveTimer.current);
      if (pendingDesign.current) {
        apiFetch(`/api/projects/${id}/cover`, { method: 'PUT', body: pendingDesign.current, keepalive: true }).catch(() => {});
      }
    },
    [id]
  );

  const update = <K extends keyof CoverDesign>(key: K, value: CoverDesign[K]) => {
    if (!design) return;
    const next = { ...design, [key]: value };
    setDesign(next);

    // Only save designs the API will accept (e.g. half-typed colors wait)
    if (!coverDesignSchema.safeParse(next).success) return;
    clearTimeout(saveTimer.current);
    pendingDesign.current = next;
    setSaveState('saving');
    saveTimer.current = setTimeout(() => {
      pendingDesign.current = null;
      apiFetch(`/api/projects/${id}/cover`, { method: 'PUT', body: next })
        .then(() => setSaveState('saved'))
        .catch(() => setSaveState('error'));
    }, SAVE_DELAY_MS);
  };

  const layout = useMemo(
    () => (project && design ? layoutCover({ ...design, trimSize: project.trimSize, pageCount: project.pageCount, paper: project.paper }) : null),
    [project, design]
  );

  if (error) return <p className="mx-auto w-full max-w-6xl text-sm text-destructive">{error}</p>;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/projects/${id}`} aria-label="Back to project"><ArrowLeftIcon /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Cover design</h1>
            <p className="text-muted-foreground">{project?.title ?? ' '}</p>
          </div>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>Changes save automatically.</CardDescription>
          </CardHeader>
          <CardContent>
            {!design ? (
              <Skeleton className="h-96" />
            ) : (
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="c-title">Title</FieldLabel>
                  <Input id="c-title" value={design.title} onChange={(e) => update('title', e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-subtitle">Subtitle</FieldLabel>
                  <Input id="c-subtitle" value={design.subtitle} onChange={(e) => update('subtitle', e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-author">Author</FieldLabel>
                  <Input id="c-author" value={design.author} onChange={(e) => update('author', e.target.value)} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="c-back">Back cover text</FieldLabel>
                  <Textarea id="c-back" rows={5} value={design.backText} onChange={(e) => update('backText', e.target.value)} />
                </Field>

                <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">Style</FieldSeparator>

                <div className="grid grid-cols-3 gap-3">
                  <ColorField id="c-bg" label="Cover" value={design.backgroundColor} onChange={(v) => update('backgroundColor', v)} />
                  <ColorField id="c-spine" label="Spine" value={design.spineColor} onChange={(v) => update('spineColor', v)} />
                  <ColorField id="c-text" label="Text" value={design.textColor} onChange={(v) => update('textColor', v)} />
                </div>
                <Field>
                  <FieldLabel htmlFor="c-size">Title size (pt)</FieldLabel>
                  <Input id="c-size" type="number" min={16} max={72} value={design.titleSize}
                    onChange={(e) => update('titleSize', Number(e.target.value) || 0)} />
                  <FieldDescription>Between 16 and 72.</FieldDescription>
                </Field>
              </FieldGroup>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Back · spine · front. Dashed lines mark the trim and spine folds.</CardDescription>
          </CardHeader>
          <CardContent>
            <div ref={previewRef} className="overflow-hidden rounded-lg border">
              {layout && previewWidth > 0 ? (
                <CoverPreview layout={layout} pxPerInch={previewWidth / layout.width} />
              ) : (
                <Skeleton className="aspect-[4/3] w-full" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ColorField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 cursor-pointer p-1" />
    </Field>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const content = {
    saving: [<Loader2Icon key="i" className="size-4 animate-spin" />, 'Saving…'],
    saved: [<CheckIcon key="i" className="size-4" />, 'Saved'],
    error: [<CloudAlertIcon key="i" className="size-4 text-destructive" />, 'Not saved'],
  }[state];
  return <div className="flex items-center gap-1.5 text-sm text-muted-foreground" aria-live="polite">{content}</div>;
}
