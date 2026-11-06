import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { getCurrentUser } from '@/lib/auth';
import { VerifyEmailBanner } from '@/components/verify-email-banner';
import { AppBreadcrumb, AppBreadcrumbTrail } from '@/components/app-breadcrumb';
import { AppSidebar } from '@/components/app-sidebar';
import { ModeToggle } from '@/components/mode-toggle';
import { NavUser, NavUserSkeleton } from '@/components/nav-user';
import { Separator } from '@/components/ui/separator';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';

export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <SidebarProvider>
      <AppSidebar
        user={
          // Reading the session is request-time data, so it streams in after the shell
          <Suspense fallback={<NavUserSkeleton />}>
            <SidebarUser />
          </Suspense>
        }
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <Suspense fallback={<AppBreadcrumbTrail pathname={null} />}>
              <AppBreadcrumb />
            </Suspense>
          </div>
          <ModeToggle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Suspense fallback={null}>
            <EmailVerificationNotice />
          </Suspense>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

/**
 * Banner for users who haven't verified their email yet. Also sends revoked
 * sessions to login: the proxy only checks that the cookie decodes, so a
 * session signed out from another device still reaches this layout.
 */
async function EmailVerificationNotice() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');
  const [row] = await db.select({ email: users.email, emailVerified: users.emailVerified }).from(users).where(eq(users.id, user.id));
  return row && !row.emailVerified ? <VerifyEmailBanner email={row.email} /> : null;
}

async function SidebarUser() {
  "use server";
  const user = await getCurrentUser();
  if (!user) return null;
  return <NavUser user={user} />;
}
