import { NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, memberships } from '@bookbot/db';
import { getCurrentUser } from '@/lib/auth';

export type OrgRole = 'member' | 'admin' | 'owner';

export interface OrgAccess {
  userId: string;
  orgId: string;
  role: OrgRole;
}

type Result<T> = { ok: true; value: T } | { ok: false; response: NextResponse };

const ROLE_RANK: Record<OrgRole, number> = { member: 0, admin: 1, owner: 2 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export function errorResponse(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

/**
 * Require a signed-in user
 */
export async function requireUser(): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, response: errorResponse(401, 'Unauthorized') };
  return { ok: true, value: { id: user.id } };
}

/**
 * Require the signed-in user to be a member of an organization.
 *
 * With no orgId, uses the user's oldest membership (their default org).
 * Orgs the user doesn't belong to return 404, so their existence isn't revealed.
 */
export async function requireOrgAccess(
  orgId?: string | null,
  minRole: OrgRole = 'member'
): Promise<Result<OrgAccess>> {
  const user = await requireUser();
  if (!user.ok) return user;

  if (orgId != null && !isUuid(orgId)) {
    return { ok: false, response: errorResponse(400, 'Invalid orgId') };
  }

  const [membership] = await db
    .select({ orgId: memberships.orgId, role: memberships.role })
    .from(memberships)
    .where(
      orgId
        ? and(eq(memberships.userId, user.value.id), eq(memberships.orgId, orgId))
        : eq(memberships.userId, user.value.id)
    )
    .orderBy(memberships.createdAt)
    .limit(1);

  if (!membership) {
    return { ok: false, response: errorResponse(404, 'Organization not found') };
  }
  if (ROLE_RANK[membership.role] < ROLE_RANK[minRole]) {
    return { ok: false, response: errorResponse(403, 'Insufficient permissions') };
  }

  return { ok: true, value: { userId: user.value.id, orgId: membership.orgId, role: membership.role } };
}

/**
 * Parse a JSON request body, returning null for invalid JSON
 */
export async function readJson(req: Request): Promise<unknown> {
  return req.json().catch(() => null);
}
