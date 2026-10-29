import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, exports, projects } from '@bookbot/db';
import { exportRequestSchema } from '@bookbot/shared';
import { checkEntitlement, incrementUsage } from '@/lib/entitlements';
import { errorResponse, isUuid, readJson, requireOrgAccess, requireUser } from '@/server/org-access';
import { addExportJob } from '@/server/queue';

export async function POST(req: NextRequest) {
  const parsed = exportRequestSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }
  const { projectId, spec } = parsed.data;

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  // The project must belong to the org being billed for the export
  const [project] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.orgId, orgId)))
    .limit(1);
  if (!project) {
    return errorResponse(404, 'Project not found');
  }

  // Check entitlement
  const entitlement = await checkEntitlement(orgId, 'exportsPerMonth');
  if (!entitlement.allowed) {
    return errorResponse(429, 'Export limit exceeded', { limit: entitlement.limit, used: entitlement.used });
  }

  // Create export record
  const [exportRecord] = await db
    .insert(exports)
    .values({
      projectId,
      status: 'pending',
      spec,
    })
    .returning();

  try {
    await addExportJob(exportRecord.id);
  } catch (err) {
    console.error(`Failed to queue export ${exportRecord.id}:`, err);
    await db
      .update(exports)
      .set({ status: 'failed', errorMessage: 'Could not queue export', updatedAt: new Date() })
      .where(eq(exports.id, exportRecord.id));
    return errorResponse(503, 'Export service unavailable, please try again');
  }

  // Only count exports that were actually queued
  await incrementUsage(orgId, 'exportsPerMonth');

  return NextResponse.json({
    exportId: exportRecord.id,
    status: 'pending',
  });
}

export async function GET(req: NextRequest) {
  // Check sign-in before touching the database, so anonymous callers can't
  // probe which export IDs exist
  const user = await requireUser();
  if (!user.ok) return user.response;

  const exportId = req.nextUrl.searchParams.get('exportId');
  if (!isUuid(exportId)) {
    return errorResponse(400, 'Missing or invalid exportId');
  }

  const [row] = await db
    .select({ export: exports, orgId: projects.orgId })
    .from(exports)
    .innerJoin(projects, eq(exports.projectId, projects.id))
    .where(eq(exports.id, exportId))
    .limit(1);

  if (!row) {
    return errorResponse(404, 'Export not found');
  }

  // Exports in orgs the user doesn't belong to look the same as missing ones
  const access = await requireOrgAccess(row.orgId);
  if (!access.ok) {
    return errorResponse(404, 'Export not found');
  }

  const { r2Key, ...exportData } = row.export;
  return NextResponse.json({
    ...exportData,
    downloadUrl: exportData.status === 'completed' && r2Key ? `/api/export/${exportData.id}/download` : null,
  });
}
