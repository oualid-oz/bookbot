import { eq, and, gte, desc } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { keywordCache, nicheSnapshots, savedNiches } from '@bookbot/db/schema';

const CACHE_TTL_DAYS = 7;

export type Marketplace = (typeof keywordCache.marketplace.enumValues)[number];

/**
 * Get keyword data from cache
 */
export async function getCachedKeyword(
  orgId: string,
  keyword: string,
  marketplace: Marketplace = 'US'
) {
  const cached = await db
    .select()
    .from(keywordCache)
    .where(
      and(
        eq(keywordCache.orgId, orgId),
        eq(keywordCache.keyword, keyword),
        eq(keywordCache.marketplace, marketplace),
        gte(keywordCache.expiresAt, new Date())
      )
    )
    .limit(1);

  return cached[0] || null;
}

/**
 * Cache keyword data
 */
export async function cacheKeyword(
  orgId: string,
  keyword: string,
  marketplace: Marketplace,
  data: { volume: number; competition: number }
) {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + CACHE_TTL_DAYS);

  await db.insert(keywordCache).values({
    orgId,
    keyword,
    marketplace,
    volume: data.volume,
    competition: String(data.competition),
    expiresAt,
  }).onConflictDoUpdate({
    // Refresh an expired entry in place
    target: [keywordCache.orgId, keywordCache.keyword, keywordCache.marketplace],
    set: {
      volume: data.volume,
      competition: String(data.competition),
      fetchedAt: new Date(),
      expiresAt,
    },
  });
}

/**
 * Save niche snapshot
 */
export async function saveNicheSnapshot(
  orgId: string,
  keyword: string,
  marketplace: Marketplace,
  topResults: any[],
  score: number
) {
  await db.insert(nicheSnapshots).values({
    orgId,
    keyword,
    marketplace,
    topResults,
    score: String(score),
  });
}

/**
 * Get saved niche snapshot
 */
export async function getNicheSnapshot(
  orgId: string,
  keyword: string,
  marketplace: Marketplace = 'US'
) {
  const snapshot = await db
    .select()
    .from(nicheSnapshots)
    .where(
      and(
        eq(nicheSnapshots.orgId, orgId),
        eq(nicheSnapshots.keyword, keyword),
        eq(nicheSnapshots.marketplace, marketplace)
      )
    )
    .orderBy(desc(nicheSnapshots.fetchedAt))
    .limit(1);

  return snapshot[0] || null;
}

/**
 * Save niche to favorites
 */
export async function saveNiche(
  orgId: string,
  keyword: string,
  notes?: string
) {
  await db.insert(savedNiches).values({
    orgId,
    keyword,
    notes,
  });
}

/**
 * Get saved niches
 */
export async function getSavedNiches(orgId: string) {
  return db
    .select()
    .from(savedNiches)
    .where(eq(savedNiches.orgId, orgId))
    .orderBy(savedNiches.createdAt);
}

/**
 * Delete saved niche
 */
export async function deleteSavedNiche(orgId: string, id: string) {
  await db.delete(savedNiches).where(and(eq(savedNiches.orgId, orgId), eq(savedNiches.id, id)));
}
