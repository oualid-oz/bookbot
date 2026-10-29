import { createHash, randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, lt, or } from 'drizzle-orm';
import { db, extensionTokens, memberships } from '@bookbot/db';
import { errorResponse } from './org-access';

const TOKEN_PREFIX = 'bbx_';
/** Don't write last-used time on every request */
const LAST_USED_RESOLUTION_MS = 5 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export function serializeToken(row: typeof extensionTokens.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

/**
 * Create a token. The returned `token` is the only time it's ever visible.
 */
export async function createExtensionToken(input: { orgId: string; userId: string; name: string; expiresInDays?: number }) {
  const token = TOKEN_PREFIX + randomBytes(32).toString('base64url');
  const [row] = await db
    .insert(extensionTokens)
    .values({
      orgId: input.orgId,
      userId: input.userId,
      name: input.name,
      tokenHash: hashToken(token),
      expiresAt: input.expiresInDays ? new Date(Date.now() + input.expiresInDays * 86_400_000) : null,
    })
    .returning();
  return { token, record: serializeToken(row) };
}

/** The user's active tokens in an org */
export async function listExtensionTokens(orgId: string, userId: string) {
  const rows = await db
    .select()
    .from(extensionTokens)
    .where(and(eq(extensionTokens.orgId, orgId), eq(extensionTokens.userId, userId), isNull(extensionTokens.revokedAt)))
    .orderBy(desc(extensionTokens.createdAt));
  return rows.map(serializeToken);
}

export async function revokeExtensionToken(orgId: string, userId: string, tokenId: string): Promise<boolean> {
  const revoked = await db
    .update(extensionTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionTokens.id, tokenId),
        eq(extensionTokens.orgId, orgId),
        eq(extensionTokens.userId, userId),
        isNull(extensionTokens.revokedAt)
      )
    )
    .returning({ id: extensionTokens.id });
  return revoked.length > 0;
}

/**
 * Check a bearer token: it must exist, not be revoked or expired, and its
 * user must still belong to its org.
 */
export async function verifyExtensionToken(token: string) {
  if (!token.startsWith(TOKEN_PREFIX)) return null;

  const now = new Date();
  const [row] = await db
    .select({ id: extensionTokens.id, orgId: extensionTokens.orgId, userId: extensionTokens.userId, lastUsedAt: extensionTokens.lastUsedAt })
    .from(extensionTokens)
    .innerJoin(
      memberships,
      and(eq(memberships.orgId, extensionTokens.orgId), eq(memberships.userId, extensionTokens.userId))
    )
    .where(
      and(
        eq(extensionTokens.tokenHash, hashToken(token)),
        isNull(extensionTokens.revokedAt),
        or(isNull(extensionTokens.expiresAt), gt(extensionTokens.expiresAt, now))
      )
    )
    .limit(1);
  if (!row) return null;

  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > LAST_USED_RESOLUTION_MS) {
    await db
      .update(extensionTokens)
      .set({ lastUsedAt: now })
      .where(
        and(
          eq(extensionTokens.id, row.id),
          or(isNull(extensionTokens.lastUsedAt), lt(extensionTokens.lastUsedAt, new Date(now.getTime() - LAST_USED_RESOLUTION_MS)))
        )
      );
  }
  return { tokenId: row.id, orgId: row.orgId, userId: row.userId };
}

/**
 * Require a valid `Authorization: Bearer <token>` header
 */
export async function requireExtensionToken(req: Request) {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7).trim() : null;
  const verified = token ? await verifyExtensionToken(token) : null;
  if (!verified) {
    return { ok: false as const, response: errorResponse(401, 'Invalid or revoked token') };
  }
  return { ok: true as const, value: verified };
}
