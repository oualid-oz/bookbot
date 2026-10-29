import { NextRequest, NextResponse } from 'next/server';
import { revokeExtensionToken } from '@/server/extension-tokens';
import { errorResponse, isUuid, requireOrgAccess } from '@/server/org-access';

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/extension/tokens/[id]'>) {
  const { id } = await ctx.params;
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;

  if (!isUuid(id) || !(await revokeExtensionToken(access.value.orgId, access.value.userId, id))) {
    return errorResponse(404, 'Token not found');
  }
  return new NextResponse(null, { status: 204 });
}
