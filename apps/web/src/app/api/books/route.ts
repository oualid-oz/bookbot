import { NextRequest, NextResponse } from 'next/server';
import { listBooks } from '@/server/books';
import { requireOrgAccess } from '@/server/org-access';

/** Books saved from the extension */
export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;
  return NextResponse.json({ books: await listBooks(access.value.orgId) });
}
