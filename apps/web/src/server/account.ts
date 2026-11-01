import { and, count, eq, inArray } from 'drizzle-orm';
import { assets, db, exports, memberships, organizations, projects, subscriptions, users, verificationTokens } from '@bookbot/db';
import { deleteStoredFiles } from './stored-files';

export type DeleteAccountResult = { ok: true } | { ok: false; reason: 'subscription' };

/**
 * Delete a user, every organization they are the only member of (with its
 * projects, files and usage), and their pending email links.
 *
 * Refused while one of those organizations has a subscription that will
 * renew: the user must cancel it first, or Stripe would keep charging them.
 */
export async function deleteAccount(userId: string): Promise<DeleteAccountResult> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
  if (!user) return { ok: true };

  const userOrgs = db.select({ orgId: memberships.orgId }).from(memberships).where(eq(memberships.userId, userId));
  const soleOrgIds = (
    await db
      .select({ orgId: memberships.orgId, members: count() })
      .from(memberships)
      .where(inArray(memberships.orgId, userOrgs))
      .groupBy(memberships.orgId)
  )
    .filter((org) => org.members === 1)
    .map((org) => org.orgId);

  if (soleOrgIds.length > 0) {
    const [renewing] = await db
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(
        and(
          inArray(subscriptions.orgId, soleOrgIds),
          inArray(subscriptions.status, ['active', 'trialing', 'past_due']),
          eq(subscriptions.cancelAtPeriodEnd, false)
        )
      )
      .limit(1);
    if (renewing) return { ok: false, reason: 'subscription' };
  }

  const files =
    soleOrgIds.length === 0
      ? []
      : [
          ...(await db.select({ key: assets.r2Key }).from(assets).where(inArray(assets.orgId, soleOrgIds))),
          ...(await db
            .select({ key: exports.r2Key })
            .from(exports)
            .innerJoin(projects, eq(exports.projectId, projects.id))
            .where(inArray(projects.orgId, soleOrgIds))),
        ];

  await db.transaction(async (tx) => {
    if (soleOrgIds.length > 0) {
      await tx.delete(organizations).where(inArray(organizations.id, soleOrgIds));
    }
    await tx
      .delete(verificationTokens)
      .where(inArray(verificationTokens.identifier, [`verify:${user.email}`, `reset:${user.email}`]));
    // Memberships, linked accounts and extension tokens cascade
    await tx.delete(users).where(eq(users.id, userId));
  });

  await deleteStoredFiles(files.map((f) => f.key));
  return { ok: true };
}
