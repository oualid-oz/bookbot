import { withAuth } from 'next-auth/middleware';

// Every page is private unless listed here. Pages in app/(app) are protected
// automatically; new public pages belong in app/(marketing) or app/(auth).
const PUBLIC_PATHS = ['/', '/pricing', '/privacy', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ req, token }) => !!token || PUBLIC_PATHS.includes(req.nextUrl.pathname),
  },
});

export const config = {
  // API routes check auth themselves (and the extension uses bearer tokens);
  // icons and the web manifest must load for signed-out visitors too
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-\\d+\\.png|manifest.webmanifest).*)'],
};
