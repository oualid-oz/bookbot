import { NextRequest, NextResponse } from 'next/server';
import { bookNotesSchema } from '@bookbot/shared';
import { deleteBook, updateBookNotes } from '@/server/books';
import { errorResponse, isUuid, readJson, requireOrgAccess } from '@/server/org-access';

/** Update the user's notes and tags on a saved book */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/books/[id]'>) {
  const { id } = await ctx.params;
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;

  const parsed = bookNotesSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const book = isUuid(id) ? await updateBookNotes(access.value.orgId, id, parsed.data) : null;
  if (!book) return errorResponse(404, 'Book not found');
  return NextResponse.json({ book });
}

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/books/[id]'>) {
  const { id } = await ctx.params;
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;

  if (!isUuid(id) || !(await deleteBook(access.value.orgId, id))) {
    return errorResponse(404, 'Book not found');
  }
  return new NextResponse(null, { status: 204 });
}
