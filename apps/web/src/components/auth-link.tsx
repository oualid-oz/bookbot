'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { withCallbackUrl } from '@/lib/callback-url';

/** Link between login and signup that keeps ?callbackUrl= (read on click, since it's in the URL) */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault();
        router.push(withCallbackUrl(href));
      }}
    >
      {children}
    </Link>
  );
}
