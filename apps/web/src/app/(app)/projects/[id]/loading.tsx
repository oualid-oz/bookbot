import { Skeleton } from '@/components/ui/skeleton';

/** Same shape as the project wizard: title, six steps, then the open step */
export default function ProjectLoading() {
  return (
    <div role="status" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex justify-between gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-2">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="hidden h-4 w-14 sm:block" />
          </div>
        ))}
      </div>
      <Skeleton className="h-96 rounded-xl" />
    </div>
  );
}
