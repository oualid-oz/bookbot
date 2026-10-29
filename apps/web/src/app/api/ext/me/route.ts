import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, organizations, users } from '@bookbot/db';
import { requireExtensionToken } from '@/server/extension-tokens';

/**
 * Who a token belongs to; lets the extension confirm it's connected
 */
export async function GET(req: NextRequest) {
  const auth = await requireExtensionToken(req);
  if (!auth.ok) return auth.response;

  const [org] = await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, auth.value.orgId));
  const [user] = await db.select({ email: users.email }).from(users).where(eq(users.id, auth.value.userId));
  return NextResponse.json({ org: org?.name, user: user?.email });
}
