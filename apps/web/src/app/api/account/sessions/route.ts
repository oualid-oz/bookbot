import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/server/org-access';
import { updateSessionCookie } from '@/server/session-cookie';
import { bumpSessionVersion } from '@/server/users';

/** Sign out every other device; this browser stays signed in */
export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const sv = await bumpSessionVersion(auth.value.id);
  const res = NextResponse.json({ signedOut: true });
  await updateSessionCookie(req, res, auth.value.id, { sv });
  return res;
}
