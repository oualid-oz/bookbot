import { NextRequest, NextResponse } from 'next/server';
import { projectCreateSchema } from '@bookbot/shared';
import { PLAN_LIMITS, getOrgPlan } from '@/lib/entitlements';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';
import { countProjects, createProject, listProjects } from '@/server/projects';

export async function GET(req: NextRequest) {
  const access = await requireOrgAccess(req.nextUrl.searchParams.get('orgId'));
  if (!access.ok) return access.response;

  return NextResponse.json({ projects: await listProjects(access.value.orgId) });
}

export async function POST(req: NextRequest) {
  const parsed = projectCreateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const access = await requireOrgAccess(parsed.data.orgId);
  if (!access.ok) return access.response;
  const { orgId } = access.value;

  // Projects are a standing count, not a per-period usage metric
  const limit = PLAN_LIMITS[await getOrgPlan(orgId)].projects;
  const used = await countProjects(orgId);
  if (limit !== -1 && used >= limit) {
    return errorResponse(429, 'Project limit reached for your plan', { limit, used });
  }

  return NextResponse.json({ project: await createProject(orgId, parsed.data) }, { status: 201 });
}
