import Link from 'next/link';
import { BookOpenIcon } from 'lucide-react';

export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <Link href="/" className="flex items-center gap-2 self-center font-medium">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <BookOpenIcon className="size-4" />
          </div>
          Bookbot
        </Link>
        {children}
      </div>
    </div>
  );
}
