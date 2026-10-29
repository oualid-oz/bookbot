import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { signupSchema } from '@bookbot/shared';
import { hashPassword } from '@/lib/password';
import { consumeToken } from '@/server/account-emails';
import { errorResponse, readJson } from '@/server/org-access';

const confirmSchema = z.object({
  token: z.string().min(1).max(200),
  password: signupSchema.shape.password,
});

/** Set a new password from the link in the reset email */
export async function POST(req: NextRequest) {
  const parsed = confirmSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const email = await consumeToken('reset', parsed.data.token);
  if (!email) {
    return errorResponse(400, 'This link is invalid or has expired', { fields: { token: ['This link is invalid or has expired'] } });
  }

  // Opening the link proves the user owns the email
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.password), emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.email, email));
  return NextResponse.json({ reset: true });
}
