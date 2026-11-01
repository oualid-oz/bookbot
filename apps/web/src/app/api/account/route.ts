import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, users } from '@bookbot/db';
import { accountDeleteSchema, profileUpdateSchema } from '@bookbot/shared';
import { verifyPassword } from '@/lib/password';
import { checkRateLimit } from '@/lib/rate-limit';
import { deleteAccount } from '@/server/account';
import { errorResponse, readJson, requireUser } from '@/server/org-access';
import { updateSessionCookie } from '@/server/session-cookie';

/** The signed-in user's account status */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;
  const [user] = await db
    .select({ name: users.name, email: users.email, emailVerified: users.emailVerified, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.value.id));
  if (!user) return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  return NextResponse.json({
    name: user.name,
    email: user.email,
    emailVerified: !!user.emailVerified,
    hasPassword: !!user.passwordHash,
  });
}

/** Update the signed-in user's profile */
export async function PATCH(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = profileUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const { name } = parsed.data;
  await db.update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, auth.value.id));

  // The session holds the name shown in the sidebar
  const res = NextResponse.json({ name });
  await updateSessionCookie(req, res, auth.value.id, { name });
  return res;
}

/** Delete the signed-in user's account and their workspace */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const parsed = accountDeleteSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const [user] = await db
    .select({ email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, auth.value.id));
  if (!user) return errorResponse(404, 'Account not found');

  // Confirm it's really the owner: with the password if there is one, else by typing the email
  if (user.passwordHash) {
    const limit = await checkRateLimit(`account-confirm:${auth.value.id}`, 10, 15 * 60 * 1000);
    if (!limit.allowed) return errorResponse(429, 'Too many attempts. Try again later.');
    if (!parsed.data.password || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return errorResponse(400, 'Incorrect password', { fields: { password: ['Incorrect password'] } });
    }
  } else if (parsed.data.email !== user.email) {
    return errorResponse(400, 'Type your email to confirm', { fields: { email: ['Type your email to confirm'] } });
  }

  const result = await deleteAccount(auth.value.id);
  if (!result.ok) {
    return errorResponse(409, 'Cancel your subscription in Billing before deleting your account');
  }
  return NextResponse.json({ deleted: true });
}
