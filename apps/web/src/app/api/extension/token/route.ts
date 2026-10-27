import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { generateExtensionToken } from '@/lib/tokens';
import { getOrgBySlugWithAuth } from '@bookbot/db';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { orgSlug } = body;

  if (!orgSlug) {
    return NextResponse.json({ error: 'Missing orgSlug' }, { status: 400 });
  }

  // Verify user belongs to org
  const org = await getOrgBySlugWithAuth(orgSlug, user.id);
  if (!org) {
    return NextResponse.json({ error: 'Organization not found or access denied' }, { status: 403 });
  }

  // Generate token
  const token = generateExtensionToken(org.org.id);

  return NextResponse.json({ token });
}
