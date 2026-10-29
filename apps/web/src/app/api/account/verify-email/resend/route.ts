import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { sendVerificationEmail } from '@/server/account-emails';
import { errorResponse, requireUser } from '@/server/org-access';

/** Send a fresh verification link to the signed-in user */
export async function POST() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const [user] = await db.select({ email: users.email, emailVerified: users.emailVerified }).from(users).where(eq(users.id, auth.value.id));
  if (!user) return errorResponse(404, 'Account not found');
  if (user.emailVerified) return NextResponse.json({ alreadyVerified: true });

  if (!(await checkRateLimit(`verify-resend:${auth.value.id}`, 3, 60 * 60 * 1000)).allowed) {
    return errorResponse(429, 'Too many emails sent. Try again later.');
  }
  await sendVerificationEmail(user.email);
  return NextResponse.json({ sent: true });
}
