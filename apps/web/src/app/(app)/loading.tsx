import { Skeleton } from '@/components/ui/skeleton';

/** Shown inside the sidebar while a page loads */
export default function AppLoading() {
  return (
    <div role="status" className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
