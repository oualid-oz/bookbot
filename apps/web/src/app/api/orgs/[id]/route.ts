import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db, organizations } from '@bookbot/db';
import { orgUpdateSchema } from '@bookbot/shared';
import { errorResponse, readJson, requireOrgAccess } from '@/server/org-access';

/** Rename an organization (admins and owners) */
export async function PATCH(req: NextRequest, ctx: RouteContext<'/api/orgs/[id]'>) {
  const { id } = await ctx.params;
  const access = await requireOrgAccess(id, 'admin');
  if (!access.ok) return access.response;

  const parsed = orgUpdateSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return errorResponse(400, 'Invalid input', { fields: parsed.error.flatten().fieldErrors });
  }

  const [org] = await db
    .update(organizations)
    .set({ name: parsed.data.name, updatedAt: new Date() })
    .where(eq(organizations.id, access.value.orgId))
    .returning({ id: organizations.id, name: organizations.name, slug: organizations.slug });
  return NextResponse.json({ org });
}
