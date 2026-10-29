import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { sendPasswordResetEmail } from '@/server/account-emails';
import { errorResponse, readJson } from '@/server/org-access';

const HOUR = 60 * 60 * 1000;

/**
 * Email a password reset link. Always answers the same way, so it can't be
 * used to find out which emails have accounts.
 */
export async function POST(req: NextRequest) {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email() }).safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: { email: ['Enter a valid email address'] } });
  }
  const { email } = parsed.data;

  const [byIp, byEmail] = await Promise.all([
    checkRateLimit(`reset-ip:${getClientIp(req.headers)}`, 10, HOUR),
    checkRateLimit(`reset-email:${email}`, 3, HOUR),
  ]);
  if (!byIp.allowed) {
    return errorResponse(429, 'Too many requests. Try again later.');
  }

  // Quietly skip unknown emails and repeated requests for one address
  if (byEmail.allowed) {
    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (user) await sendPasswordResetEmail(email);
  }

  return NextResponse.json({ sent: true });
}
