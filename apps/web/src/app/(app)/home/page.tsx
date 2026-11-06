'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BookmarkIcon, CheckCircle2Icon, DownloadIcon, FileTextIcon, ImageIcon } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { PROJECT_TYPE_LABELS, type ProjectSummary } from '@/components/project-options';
import { buildSteps, completion, nextStep, type ProjectProgress } from '@/components/project-steps';
import { NewProjectDialog } from '../projects/new-project-dialog';

interface Meter {
  used: number;
  limit: number;
}

interface HomeData {
  projects: { project: ProjectSummary; progress: ProjectProgress }[];
  exports: { id: string; kind: 'interior' | 'cover'; title: string; projectId: string; completedAt: string; downloadUrl: string }[];
  plan: 'free' | 'pro' | 'enterprise';
  usage: { exportsPerMonth: Meter; projects: Meter };
  savedBooks: number;
}

const PLAN_NAMES: Record<HomeData['plan'], string> = { free: 'Free', pro: 'Pro', enterprise: 'Enterprise' };

const GETTING_STARTED = [
  { title: 'Create a book', text: 'A puzzle book, a journal, or any other book.' },
  { title: 'Fill and design it', text: 'Add puzzles, then style the pages and the cover.' },
  { title: 'Export for KDP', text: 'Write your Amazon listing and download print-ready PDFs.' },
];

function BookCard({ project, progress }: HomeData['projects'][number]) {
  const steps = buildSteps(project, progress);
  const next = nextStep(steps);
  const percent = completion(steps);

  return (
    <div className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/projects/${project.id}`} className="line-clamp-1 font-medium hover:underline">{project.title}</Link>
          <Badge variant="secondary" className="mt-1">{PROJECT_TYPE_LABELS[project.type]}</Badge>
        </div>
        <span className="text-sm text-muted-foreground tabular-nums">{percent}%</span>
      </div>
      <Progress value={percent} aria-label={`${project.title}: ${percent}% done`} />
      {next ? (
        <Button variant="outline" size="sm" className="self-start" asChild>
          <Link href={`/projects/${project.id}?step=${next.id}`}>
            Next: {next.title}
            {next.hint && <span className="text-muted-foreground">({next.hint})</span>}
            <ArrowRightIcon />
          </Link>
        </Button>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2Icon className="size-4 text-primary" />
          Ready to upload to KDP
        </p>
      )}
    </div>
  );
}

function UsageMeter({ label, meter }: { label: string; meter: Meter }) {
  const unlimited = meter.limit === -1;
  const percent = unlimited ? 0 : Math.min(100, (meter.used / Math.max(meter.limit, 1)) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground tabular-nums">{unlimited ? `${meter.used} used` : `${meter.used} of ${meter.limit}`}</span>
      </div>
      {!unlimited && <Progress value={percent} aria-label={label} className={percent >= 100 ? '[&>*]:bg-destructive' : undefined} />}
    </div>
  );
}

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<HomeData>('/api/home')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-6xl">
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      </div>
    );
  }

  const isNew = data?.projects.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Home</h1>
          <p className="text-muted-foreground">{isNew ? 'Welcome to Bookbot. Let’s make your first book.' : 'Pick up where you left off.'}</p>
        </div>
        <NewProjectDialog />
      </div>

      {!data ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-72 rounded-xl lg:col-span-2" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-6 lg:col-span-2">
            {isNew ? (
              <Card>
                <CardHeader>
                  <CardTitle>Getting started</CardTitle>
                  <CardDescription>From idea to a book ready for Amazon, in three steps.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-4">
                    {GETTING_STARTED.map((step, i) => (
                      <li key={step.title} className="flex gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full border text-sm font-medium">{i + 1}</span>
                        <div>
                          <p className="font-medium">{step.title}</p>
                          <p className="text-sm text-muted-foreground">{step.text}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Continue your books</CardTitle>
                  <CardDescription>
                    Your latest edits. <Link href="/projects" className="underline underline-offset-2">See all projects</Link>
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {data.projects.map((item) => <BookCard key={item.project.id} {...item} />)}
                </CardContent>
              </Card>
            )}

            {data.exports.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent exports</CardTitle>
                  <CardDescription>Print-ready PDFs to upload to KDP.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col divide-y">
                    {data.exports.map((row) => (
                      <li key={row.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                        {row.kind === 'cover' ? <ImageIcon className="size-4 shrink-0 text-muted-foreground" /> : <FileTextIcon className="size-4 shrink-0 text-muted-foreground" />}
                        <div className="min-w-0 flex-1">
                          <Link href={`/projects/${row.projectId}?step=export`} className="line-clamp-1 text-sm font-medium hover:underline">{row.title}</Link>
                          <p className="text-xs text-muted-foreground capitalize">
                            {row.kind} · {new Date(row.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon-sm" asChild>
                          <a href={row.downloadUrl} aria-label={`Download ${row.kind} of ${row.title}`}><DownloadIcon /></a>
                        </Button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Your plan
                  <Badge variant="secondary">{PLAN_NAMES[data.plan]}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <UsageMeter label="Exports this month" meter={data.usage.exportsPerMonth} />
                <UsageMeter label="Projects" meter={data.usage.projects} />
                <Button variant="outline" size="sm" className="self-start" asChild>
                  <Link href="/settings/billing">{data.plan === 'free' ? 'Upgrade plan' : 'Manage plan'}</Link>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookmarkIcon className="size-4" />
                  Saved books
                </CardTitle>
                <CardDescription>
                  {data.savedBooks === 0
                    ? 'Save books from Amazon with the Chrome extension to study them here.'
                    : `${data.savedBooks} book${data.savedBooks === 1 ? '' : 's'} saved from Amazon.`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" asChild>
                  <Link href={data.savedBooks === 0 ? '/settings/extension' : '/research'}>
                    {data.savedBooks === 0 ? 'Set up the extension' : 'View saved books'}
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
