import { Skeleton } from '@/components/ui/skeleton';

/** Same shape as the Home page, so nothing jumps when it arrives */
export default function HomeLoading() {
  return (
    <div role="status" className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
