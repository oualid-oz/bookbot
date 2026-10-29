'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { PROJECT_TYPE_LABELS, TRIM_OPTIONS, type ProjectSummary } from '@/components/project-options';
import { NewProjectDialog } from './new-project-dialog';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ projects: ProjectSummary[] }>('/api/projects')
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground">Your books, puzzle books, and journals.</p>
        </div>
        <NewProjectDialog />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {projects === null && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : projects?.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center">
          <BookOpenIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">No projects yet</p>
            <p className="text-sm text-muted-foreground">Create your first book to start designing and exporting.</p>
          </div>
          <NewProjectDialog />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects?.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`} className="rounded-xl focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
              <Card className="h-full transition-colors hover:bg-muted/50">
                <CardHeader>
                  <CardTitle className="line-clamp-1">{project.title}</CardTitle>
                  <CardDescription className="line-clamp-1">{project.subtitle || ' '}</CardDescription>
                </CardHeader>
                <CardFooter className="mt-auto flex flex-wrap gap-2 border-t pt-4">
                  <Badge variant="secondary">{PROJECT_TYPE_LABELS[project.type]}</Badge>
                  <Badge variant="outline">{TRIM_OPTIONS.find((o) => o.value === project.trimSize)?.label ?? project.trimSize}</Badge>
                  <Badge variant="outline">{project.pageCount} pages</Badge>
                </CardFooter>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
