import { NextResponse } from 'next/server';
import { getUserOrgs } from '@/server/users';
import { requireUser } from '@/server/org-access';

/**
 * List the organizations the signed-in user belongs to
 */
export async function GET() {
  const user = await requireUser();
  if (!user.ok) return user.response;

  return NextResponse.json({ orgs: await getUserOrgs(user.value.id) });
}
