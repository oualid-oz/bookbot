import { NextRequest, NextResponse } from 'next/server';
import { deleteBook } from '@/server/books';
import { errorResponse, isUuid, requireOrgAccess } from '@/server/org-access';

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/books/[id]'>) {
  const { id } = await ctx.params;
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;

  if (!isUuid(id) || !(await deleteBook(access.value.orgId, id))) {
    return errorResponse(404, 'Book not found');
  }
  return new NextResponse(null, { status: 204 });
}
