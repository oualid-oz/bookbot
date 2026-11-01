import type { NextRequest, NextResponse } from 'next/server';
import { encode, getToken, type JWT } from 'next-auth/jwt';

// NextAuth's default session length (30 days)
const MAX_AGE = 30 * 24 * 60 * 60;
const COOKIE_NAMES = ['__Secure-next-auth.session-token', 'next-auth.session-token'];

/**
 * Rewrite the caller's session cookie with changes, e.g. a new session
 * version after "sign out other devices", so this browser stays signed in.
 *
 * Does nothing if the request has no session cookie for `userId`; that
 * browser then signs in again.
 */
export async function updateSessionCookie(
  req: NextRequest,
  res: NextResponse,
  userId: string,
  changes: Partial<JWT>
): Promise<void> {
  const secret = process.env.NEXTAUTH_SECRET;
  const cookieName = COOKIE_NAMES.find((name) => req.cookies.has(name));
  if (!secret || !cookieName) return;

  const token = await getToken({ req, secret, cookieName });
  if (!token || token.id !== userId) return;

  res.cookies.set(cookieName, await encode({ token: { ...token, ...changes }, secret, maxAge: MAX_AGE }), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: cookieName.startsWith('__Secure-'),
    maxAge: MAX_AGE,
  });
}
