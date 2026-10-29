import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { consumeToken } from '@/server/account-emails';
import { errorResponse, readJson } from '@/server/org-access';

/** Confirm an email address from the link in the verification email */
export async function POST(req: NextRequest) {
  const parsed = z.object({ token: z.string().min(1).max(200) }).safeParse(await readJson(req));
  const email = parsed.success ? await consumeToken('verify', parsed.data.token) : null;
  if (!email) {
    return errorResponse(400, 'This link is invalid or has expired');
  }

  await db
    .update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(and(eq(users.email, email), isNull(users.emailVerified)));
  return NextResponse.json({ verified: true });
}
