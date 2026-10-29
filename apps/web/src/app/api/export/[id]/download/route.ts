import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, exports, projects } from '@bookbot/db';
import { getStorage } from '@bookbot/storage';
import { errorResponse, isUuid, requireOrgAccess, requireUser } from '@/server/org-access';

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/export/[id]/download'>) {
  const user = await requireUser();
  if (!user.ok) return user.response;

  const { id } = await ctx.params;
  if (!isUuid(id)) {
    return errorResponse(400, 'Invalid export id');
  }

  const [row] = await db
    .select({ status: exports.status, key: exports.r2Key, orgId: projects.orgId })
    .from(exports)
    .innerJoin(projects, eq(exports.projectId, projects.id))
    .where(eq(exports.id, id))
    .limit(1);

  // Exports in orgs the user doesn't belong to look the same as missing ones
  if (!row || !(await requireOrgAccess(row.orgId)).ok) {
    return errorResponse(404, 'Export not found');
  }
  if (row.status !== 'completed' || !row.key) {
    return errorResponse(409, `Export is ${row.status}`);
  }

  const file = await getStorage().get(row.key);
  if (!file) {
    return errorResponse(404, 'Export file is missing');
  }

  return new Response(Buffer.from(file), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bookbot-export-${id}.pdf"`,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, no-store',
    },
  });
}
