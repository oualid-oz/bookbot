import { Loader2Icon } from 'lucide-react';

/** Shown while a page outside the app (landing, pricing, sign-in) loads */
export default function Loading() {
  return (
    <div role="status" className="flex min-h-svh flex-1 items-center justify-center">
      <Loader2Icon className="size-6 animate-spin text-muted-foreground" aria-hidden />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
