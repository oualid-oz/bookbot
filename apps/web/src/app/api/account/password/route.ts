import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { passwordChangeSchema } from '@bookbot/shared';
import { hashPassword, verifyPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendPasswordChangedEmail } from '@/server/account-emails';
import { errorResponse, readJson, requireUser } from '@/server/org-access';
import { updateSessionCookie } from '@/server/session-cookie';
import { bumpSessionVersion } from '@/server/users';

/**
 * Change the password, or set one for an account that signs in with Google.
 * Other devices are signed out; this browser stays signed in.
 */
export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = passwordChangeSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const [user] = await db
    .select({ email: users.email, emailVerified: users.emailVerified, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.value.id));
  if (!user) return errorResponse(404, 'Account not found');

  if (user.passwordHash) {
    const limit = await checkRateLimit(`account-confirm:${auth.value.id}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return errorResponse(429, 'Too many attempts. Try again later.');
    const { currentPassword } = parsed.data;
    if (!currentPassword || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return errorResponse(400, 'Incorrect password', { fields: { currentPassword: ['Incorrect password'] } });
    }
  } else if (!user.emailVerified) {
    // Accounts without a password sign in with Google, which verifies the email; this guards anything else
    return errorResponse(403, 'Verify your email before setting a password');
  }

  const sv = await bumpSessionVersion(auth.value.id, { passwordHash: await hashPassword(parsed.data.newPassword) });

  const res = NextResponse.json({ changed: true });
  await updateSessionCookie(req, res, auth.value.id, { sv });
  await sendPasswordChangedEmail(user.email).catch((err) => console.error('Could not send password email:', err));
  return res;
}
