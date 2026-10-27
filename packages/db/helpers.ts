import { and, eq } from 'drizzle-orm';
import { db } from './db';
import { organizations, memberships } from './schema';

/**
 * Get organization by slug with permission check
 * Ensures the user belongs to the organization
 */
export async function getOrgBySlugWithAuth(slug: string, userId: string) {
  const result = await db
    .select({
      org: organizations,
      membership: memberships,
    })
    .from(organizations)
    .innerJoin(memberships, eq(organizations.id, memberships.orgId))
    .where(
      and(
        eq(organizations.slug, slug),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);

  return result[0] || null;
}

/**
 * Check if user has required role in organization
 */
export async function hasOrgRole(orgId: string, userId: string, role: 'owner' | 'admin' | 'member' = 'member') {
  const membership = await db
    .select()
    .from(memberships)
    .where(
      and(
        eq(memberships.orgId, orgId),
        eq(memberships.userId, userId)
      )
    )
    .limit(1);

  if (!membership[0]) return false;

  const roleHierarchy = ['member', 'admin', 'owner'];
  const userRoleIndex = roleHierarchy.indexOf(membership[0].role);
  const requiredRoleIndex = roleHierarchy.indexOf(role);

  return userRoleIndex >= requiredRoleIndex;
}
