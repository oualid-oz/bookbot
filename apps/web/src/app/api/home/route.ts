import { NextResponse } from 'next/server';
import { and, count, desc, eq } from 'drizzle-orm';
import { db, exports, listings, projects, trackedBooks } from '@bookbot/db';
import { exportSpecSchema } from '@bookbot/shared';
import { PLAN_LIMITS, getOrgPlan, getUsage } from '@/lib/entitlements';
import { requireOrgAccess } from '@/server/org-access';
import { getProjectProgress } from '@/server/progress';
import { countProjects, serializeProject } from '@/server/projects';

const RECENT_PROJECTS = 3;
const RECENT_EXPORTS = 5;

/** Everything on the Home page, for the signed-in user's workspace */
export async function GET() {
  const access = await requireOrgAccess();
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  const [recent, finished, plan, exportsUsed, projectCount, [books]] = await Promise.all([
    db
      .select({ project: projects, listing: listings })
      .from(projects)
      .leftJoin(listings, eq(listings.projectId, projects.id))
      .where(eq(projects.orgId, orgId))
      .orderBy(desc(projects.updatedAt))
      .limit(RECENT_PROJECTS),
    db
      .select({ id: exports.id, spec: exports.spec, completedAt: exports.completedAt, projectId: projects.id, title: listings.title })
      .from(exports)
      .innerJoin(projects, eq(exports.projectId, projects.id))
      .leftJoin(listings, eq(listings.projectId, projects.id))
      .where(and(eq(projects.orgId, orgId), eq(exports.status, 'completed')))
      .orderBy(desc(exports.completedAt))
      .limit(RECENT_EXPORTS),
    getOrgPlan(orgId),
    getUsage(orgId, 'exportsPerMonth'),
    countProjects(orgId),
    db.select({ n: count() }).from(trackedBooks).where(eq(trackedBooks.orgId, orgId)),
  ]);

  const recentProjects = await Promise.all(
    recent.map(async ({ project, listing }) => ({
      project: serializeProject(project, listing),
      progress: await getProjectProgress(project.id, listing),
    }))
  );

  return NextResponse.json({
    projects: recentProjects,
    exports: finished.map((row) => ({
      id: row.id,
      kind: exportSpecSchema.parse(row.spec ?? {}).kind,
      title: row.title ?? 'Untitled book',
      projectId: row.projectId,
      completedAt: row.completedAt,
      downloadUrl: `/api/export/${row.id}/download`,
    })),
    plan,
    usage: {
      exportsPerMonth: exportsUsed,
      projects: { used: projectCount, limit: PLAN_LIMITS[plan].projects },
    },
    savedBooks: books.n,
  });
}
