import type { Metadata } from 'next';
import { NotFoundMessage } from '@/components/not-found-message';

export const metadata: Metadata = { title: 'Page not found · Bookbot' };

/** Any URL that doesn't match a page */
export default function NotFound() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center p-6">
      <NotFoundMessage title="We couldn't find that page" description="The link may be old or mistyped, or the page may have moved." />
    </main>
  );
}
