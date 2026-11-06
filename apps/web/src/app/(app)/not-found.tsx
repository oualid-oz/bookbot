import type { Metadata } from 'next';
import { NotFoundMessage } from '@/components/not-found-message';

export const metadata: Metadata = { title: 'Not found · Bookbot' };

/** Something inside the app that's gone or isn't yours, shown within the sidebar */
export default function AppNotFound() {
  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <NotFoundMessage title="We couldn't find that" description="It may have been deleted, or it may belong to a different account." />
    </div>
  );
}
