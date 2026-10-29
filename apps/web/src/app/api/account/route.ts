import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { requireUser } from '@/server/org-access';

/** The signed-in user's account status */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [user] = await db
    .select({ email: users.email, emailVerified: users.emailVerified, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.value.id));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  return NextResponse.json({ email: user.email, emailVerified: !!user.emailVerified, hasPassword: !!user.passwordHash });
}
