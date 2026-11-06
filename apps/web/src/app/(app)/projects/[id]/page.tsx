'use client';

import { useCallback, useEffect, useState } from 'react';
import { notFound, useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeftIcon, ArrowRightIcon, CheckCircle2Icon, CircleAlertIcon, CircleIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiFetch } from '@/lib/api-client';
import { PROJECT_TYPE_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';
import { STEP_IDS, buildSteps, type ProjectProgress, type ProjectStep, type StepId } from '@/components/project-steps';
import { CoverStep } from './cover/cover-step';
import { DetailsCard } from './details-card';
import { ExportsCard } from './exports-card';
import { InteriorCard } from './interior-card';
import { ListingStep } from './listing/listing-step';
import { ProjectStepper } from './project-stepper';
import { PuzzlesCard } from './puzzles-card';

const STEP_INTROS: Record<StepId, string> = {
  details: 'Title, trim size, page count and paper.',
  puzzles: 'The puzzles inside the book. Each one gets its own page, with solutions at the back.',
  interior: 'How the inside pages look: page style, fonts, borders and backgrounds.',
  cover: 'The wrap-around paperback cover, sized for your trim and page count. Changes save automatically.',
  listing: 'What readers see on Amazon. Checked against KDP’s rules as you type.',
  export: 'Make the print-ready PDFs to upload to KDP.',
};

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [error, setError] = useState('');
  const [missing, setMissing] = useState(false);
  // Steps stay mounted once opened, so unsaved edits survive moving between them
  const [visited, setVisited] = useState<Set<StepId>>(new Set());

  const loadProgress = useCallback(() => {
    apiFetch<ProjectProgress>(`/api/projects/${id}/progress`)
      .then(setProgress)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    apiFetch<{ project: ProjectSummary }>(`/api/projects/${id}`)
      .then((data) => setProject(data.project))
      .catch((err) => {
        // Deleted, another account's, or not a project ID at all
        if (err instanceof ApiError && (err.status === 404 || err.status === 400)) setMissing(true);
        else setError(err.message);
      });
    loadProgress();
  }, [id, loadProgress]);

  const steps = project && progress ? buildSteps(project, progress) : null;

  // ?step= picks the step; without it, open the first one that still needs work
  const requested = searchParams.get('step') as StepId | null;
  const firstOpen = steps?.findIndex((s) => s.status === 'todo' || s.status === 'warning') ?? -1;
  const current = requested && STEP_IDS.includes(requested) ? STEP_IDS.indexOf(requested) : firstOpen === -1 ? STEP_IDS.length - 1 : firstOpen;
  const currentId = STEP_IDS[current];

  // Remember each step the first time it's shown (state set during render, as React recommends)
  if (steps && !visited.has(currentId)) setVisited(new Set(visited).add(currentId));

  const goTo = (index: number) => {
    router.replace(`/projects/${id}?step=${STEP_IDS[index]}`);
    // Statuses may have changed in the step being left
    loadProgress();
  };

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      toast.success('Project deleted');
      router.push('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete project');
    }
  };

  if (missing) notFound();
  if (error) {
    return <p className="mx-auto w-full max-w-6xl text-sm text-destructive">{error}</p>;
  }
  if (!project || !steps) {
    return (
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  /** A step's content: mounted on first visit, then hidden while another step is open */
  const panel = (stepId: StepId, content: React.ReactNode) =>
    visited.has(stepId) && (
      <div key={stepId} hidden={stepId !== currentId}>
        {content}
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{PROJECT_TYPE_LABELS[project.type]}</Badge>
            <Badge variant="outline">{TRIM_OPTIONS.find((o) => o.value === project.trimSize)?.label ?? project.trimSize}</Badge>
            <Badge variant="outline">{project.pageCount} pages</Badge>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Delete project">
              <Trash2Icon />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this project?</DialogTitle>
              <DialogDescription>
                &ldquo;{project.title}&rdquo; and its cover, puzzles, and exports will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button variant="destructive" onClick={handleDelete}>Delete project</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <ProjectStepper steps={steps} current={current} onSelect={goTo} />
      <Separator />

      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">
          {current + 1}. {steps[current].title}
        </h2>
        <p className="text-sm text-muted-foreground">{STEP_INTROS[currentId]}</p>
      </div>

      {panel('details', (
        <div className="max-w-2xl">
          <DetailsCard key={project.updatedAt} project={project} onSaved={setProject} />
        </div>
      ))}
      {panel('puzzles', <PuzzlesCard projectId={project.id} highlighted={project.type === 'puzzle_book'} onChange={loadProgress} />)}
      {panel('interior', <InteriorCard project={project} onSaved={loadProgress} />)}
      {/* The cover editor saves as you go, so it can unmount; reopening reloads the latest design */}
      {currentId === 'cover' && <CoverStep projectId={project.id} onSaved={loadProgress} />}
      {panel('listing', <ListingStep projectId={project.id} onSaved={loadProgress} />)}
      {panel('export', (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <ExportsCard projectId={project.id} onChange={loadProgress} />
          </div>
          <div className="lg:col-span-2">
            <PublishChecklist steps={steps} onSelect={goTo} />
          </div>
        </div>
      ))}

      <Separator />
      <div className="flex items-center justify-between gap-2">
        <Button variant="outline" disabled={current === 0} onClick={() => goTo(current - 1)}>
          <ArrowLeftIcon />
          Back
        </Button>
        {current < steps.length - 1 && (
          <Button onClick={() => goTo(current + 1)}>
            Next: {steps[current + 1].title}
            <ArrowRightIcon />
          </Button>
        )}
      </div>
    </div>
  );
}

/** What's left before uploading to KDP, linking back to each step */
function PublishChecklist({ steps, onSelect }: { steps: ProjectStep[]; onSelect: (index: number) => void }) {
  const items = steps.slice(0, -1).map((step, index) => ({ step, index }));
  const open = items.filter(({ step }) => step.status === 'todo' || step.status === 'warning');

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before you upload</CardTitle>
        <CardDescription>
          {open.length === 0 ? 'Everything is ready. Export both files and upload them to KDP.' : `${open.length} step${open.length > 1 ? 's' : ''} still open.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {items.map(({ step, index }) => (
            <li key={step.id}>
              <Button variant="ghost" className="w-full justify-start" onClick={() => onSelect(index)}>
                {step.status === 'done' ? (
                  <CheckCircle2Icon className="text-primary" />
                ) : step.status === 'warning' ? (
                  <CircleAlertIcon className="text-amber-600 dark:text-amber-400" />
                ) : (
                  <CircleIcon className="text-muted-foreground" />
                )}
                <span className="flex-1 text-left">{step.title}</span>
                <span className="text-xs text-muted-foreground">
                  {step.hint ?? (step.status === 'done' ? 'Done' : step.status === 'optional' ? 'Optional' : 'To do')}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
