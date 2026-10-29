'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { PaletteIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { PROJECT_TYPE_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';
import { DetailsCard } from './details-card';
import { ExportsCard } from './exports-card';
import { PuzzlesCard } from './puzzles-card';

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ project: ProjectSummary }>(`/api/projects/${id}`)
      .then((data) => setProject(data.project))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(load, [load]);

  const handleDelete = async () => {
    try {
      await apiFetch(`/api/projects/${id}`, { method: 'DELETE' });
      toast.success('Project deleted');
      router.push('/projects');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete project');
    }
  };

  if (error) {
    return <p className="mx-auto w-full max-w-5xl text-sm text-destructive">{error}</p>;
  }
  if (!project) {
    return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{PROJECT_TYPE_LABELS[project.type]}</Badge>
            <Badge variant="outline">{TRIM_OPTIONS.find((o) => o.value === project.trimSize)?.label ?? project.trimSize}</Badge>
            <Badge variant="outline">{project.pageCount} pages</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/projects/${id}/cover`}>
              <PaletteIcon />
              Design cover
            </Link>
          </Button>
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
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <DetailsCard key={project.updatedAt} project={project} onSaved={setProject} />
        </div>
        <div className="flex flex-col gap-6 lg:col-span-3">
          <ExportsCard projectId={project.id} />
          <PuzzlesCard projectId={project.id} highlighted={project.type === 'puzzle_book'} />
        </div>
      </div>
    </div>
  );
}
