import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server';

// Every page is private unless listed here. Pages in app/(app) are protected
// automatically; new public pages belong in app/(marketing) or app/(auth).
const PUBLIC_PATHS = ['/', '/pricing', '/privacy', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email'];

const authMiddleware = withAuth({
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized: ({ req, token }) => !!token || PUBLIC_PATHS.includes(req.nextUrl.pathname),
  },
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const path = req.nextUrl.pathname.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    );
    console.info(JSON.stringify({ event: 'api.request', method: req.method, path }));
    return NextResponse.next();
  }

  return authMiddleware(req as NextRequestWithAuth, event);
}

export const config = {
  // API routes check auth themselves (and the extension uses bearer tokens).
  // Public assets must load for signed-out visitors too.
  matcher: ['/api/:path*', '/((?!fonts/|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icon-\\d+\\.png|manifest.webmanifest).*)'],
};
