import { withAuth } from 'next-auth/middleware';

// Every page is private unless listed here. Pages in app/(app) are protected
// automatically; new public pages belong in app/(marketing) or app/(auth).
const PUBLIC_PATHS = ['/', '/pricing', '/login', '/signup'];

export default withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ req, token }) => !!token || PUBLIC_PATHS.includes(req.nextUrl.pathname),
  },
});

export const config = {
  // API routes check auth themselves (and the extension uses bearer tokens)
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
