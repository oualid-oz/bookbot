'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { DownloadIcon, ImageUpIcon, Loader2Icon, TriangleAlertIcon } from 'lucide-react';
import { toast } from 'sonner';
import { calculateSpineWidth, guessPageCount, planCoverConversion, type CoverSpec } from '@bookbot/core';
import { MAX_PAGE_COUNT, MIN_PAGE_COUNT, PAPER_TYPES } from '@bookbot/shared';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import { PAPER_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';
import { drawConversion, drawGuides, exportCoverPdf } from './convert';

const ACCEPTED = ['image/png', 'image/jpeg'] as const;
type Accepted = (typeof ACCEPTED)[number];
/** Preview resolution, in pixels per printed inch */
const PREVIEW_DPI = 60;

interface Loaded {
  image: HTMLImageElement;
  name: string;
  mimeType: Accepted;
}

const validPages = (pages: number) => Number.isInteger(pages) && pages >= MIN_PAGE_COUNT && pages <= MAX_PAGE_COUNT;

function SpecFields({ id, spec, onChange }: { id: string; spec: CoverSpec; onChange: (changes: Partial<CoverSpec>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field>
        <FieldLabel htmlFor={`${id}-trim`}>Trim size</FieldLabel>
        <Select value={spec.trimSize} onValueChange={(trimSize) => onChange({ trimSize })}>
          <SelectTrigger id={`${id}-trim`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {TRIM_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-pages`}>Pages</FieldLabel>
        <Input id={`${id}-pages`} type="number" min={MIN_PAGE_COUNT} max={MAX_PAGE_COUNT} value={Number.isNaN(spec.pageCount) ? '' : spec.pageCount}
          aria-invalid={!validPages(spec.pageCount)} onChange={(e) => onChange({ pageCount: e.target.valueAsNumber })} />
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-paper`}>Paper</FieldLabel>
        <Select value={spec.paper} onValueChange={(paper) => onChange({ paper })}>
          <SelectTrigger id={`${id}-paper`} className="w-full"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PAPER_TYPES.map((p) => <SelectItem key={p} value={p}>{PAPER_LABELS[p]}</SelectItem>)}
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

export default function CoverConverterPage() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [source, setSource] = useState<CoverSpec>({ trimSize: '6x9', pageCount: 100, paper: 'white' });
  const [target, setTarget] = useState<CoverSpec>({ trimSize: '6x9', pageCount: 100, paper: 'white' });
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [converting, setConverting] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const objectUrl = useRef<string | null>(null);

  useEffect(() => {
    apiFetch<{ projects: ProjectSummary[] }>('/api/projects')
      .then((data) => setProjects(data.projects))
      .catch(() => {});
    return () => {
      if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    };
  }, []);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!(ACCEPTED as readonly string[]).includes(file.type)) {
      toast.error('Use a PNG or JPEG image of the whole cover');
      return;
    }
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    const url = URL.createObjectURL(file);
    objectUrl.current = url;
    const image = new Image();
    image.onload = () => {
      setLoaded({ image, name: file.name, mimeType: file.type as Accepted });
      // A wrap's shape gives away its page count at the chosen trim and paper
      const guess = guessPageCount(image.naturalWidth, image.naturalHeight, source.trimSize, source.paper);
      if (guess && validPages(guess)) setSource((s) => ({ ...s, pageCount: guess }));
    };
    image.onerror = () => toast.error('Could not read that image');
    image.src = url;
  };

  const plan = useMemo(() => {
    if (!loaded || !validPages(source.pageCount) || !validPages(target.pageCount)) return null;
    return planCoverConversion(loaded.image.naturalWidth, loaded.image.naturalHeight, source, target);
  }, [loaded, source, target]);

  useEffect(() => {
    if (!plan || !loaded || !preview.current) return;
    const ctx = drawConversion(preview.current, loaded.image, plan, PREVIEW_DPI);
    drawGuides(ctx, plan, PREVIEW_DPI);
  }, [plan, loaded]);

  const download = async () => {
    if (!plan || !loaded) return;
    setConverting(true);
    try {
      const pdf = await exportCoverPdf(loaded.image, plan, loaded.mimeType);
      const url = URL.createObjectURL(pdf);
      const link = Object.assign(document.createElement('a'), { href: url, download: `cover-${target.trimSize}-${target.pageCount}p.pdf` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not convert the cover');
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cover converter</h1>
        <p className="text-muted-foreground">
          Fit a finished cover to a new trim size or page count, with the spine recalculated. Your image stays on this device.
        </p>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>1. Your current cover</CardTitle>
              <CardDescription>The whole wrap as a PNG or JPEG: back, spine and front, with bleed.</CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="cover-file">Cover image</FieldLabel>
                  <Input id="cover-file" type="file" accept={ACCEPTED.join(',')} onChange={(e) => handleFile(e.target.files?.[0])} />
                  {loaded && (
                    <FieldDescription>
                      {loaded.name}: {loaded.image.naturalWidth} × {loaded.image.naturalHeight} pixels
                    </FieldDescription>
                  )}
                </Field>
                <SpecFields id="source" spec={source} onChange={(changes) => setSource({ ...source, ...changes })} />
                <FieldDescription>The size this cover was made for, so its spine is cut in the right place.</FieldDescription>
              </FieldGroup>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>2. New size</CardTitle>
              <CardDescription>
                {validPages(target.pageCount)
                  ? `New spine: ${calculateSpineWidth(target.pageCount, target.paper).toFixed(3)}"`
                  : `Pages must be between ${MIN_PAGE_COUNT} and ${MAX_PAGE_COUNT}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FieldGroup>
                {projects.length > 0 && (
                  <Field>
                    <FieldLabel htmlFor="target-project">Use a project&apos;s size</FieldLabel>
                    <Select
                      onValueChange={(id) => {
                        const project = projects.find((p) => p.id === id);
                        if (project) setTarget({ trimSize: project.trimSize, pageCount: project.pageCount, paper: project.paper });
                      }}
                    >
                      <SelectTrigger id="target-project" className="w-full"><SelectValue placeholder="Choose a project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <SpecFields id="target" spec={target} onChange={(changes) => setTarget({ ...target, ...changes })} />
              </FieldGroup>
            </CardContent>
          </Card>
        </div>

        <Card className="lg:sticky lg:top-4">
          <CardHeader>
            <CardTitle>3. Check and download</CardTitle>
            <CardDescription>Red: where the page is trimmed. Blue: the spine. These lines aren&apos;t printed.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {plan ? (
              <>
                <canvas ref={preview} aria-label="Preview of the converted cover" className="w-full rounded-sm ring-1 ring-border" />
                <p className="text-sm text-muted-foreground">
                  {plan.width.toFixed(3)}&quot; × {plan.height.toFixed(3)}&quot; PDF, about {plan.effectiveDpi} DPI
                </p>
                {plan.warnings.length > 0 && (
                  <Alert>
                    <TriangleAlertIcon />
                    <AlertTitle>Check before you upload</AlertTitle>
                    <AlertDescription>
                      <ul className="flex list-disc flex-col gap-1 pl-4">
                        {plan.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    </AlertDescription>
                  </Alert>
                )}
                <Button onClick={download} disabled={converting} className="self-start">
                  {converting ? <Loader2Icon className="animate-spin" /> : <DownloadIcon />}
                  {converting ? 'Converting…' : 'Download PDF'}
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
                <ImageUpIcon className="size-6" />
                {loaded ? 'Enter valid page counts to see the result.' : 'Choose your cover image to see the result.'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
