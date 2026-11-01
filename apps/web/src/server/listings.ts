import { desc, eq } from 'drizzle-orm';
import { db, keywordCache, listings, projects, savedNiches } from '@bookbot/db';
import { checkListing } from '@bookbot/core';
import type { ListingUpdate } from '@bookbot/shared';
import type { ProjectAccess } from './projects';

type Listing = typeof listings.$inferSelect;

export function serializeListing(listing: Listing | null) {
  const values = {
    title: listing?.title ?? '',
    subtitle: listing?.subtitle ?? '',
    author: listing?.author ?? '',
    description: listing?.description ?? '',
    keywords: (listing?.keywords as string[] | undefined) ?? [],
    categories: (listing?.categories as string[] | undefined) ?? [],
  };
  return { listing: values, issues: checkListing(values) };
}

export async function saveListing(projectId: string, values: ListingUpdate) {
  const row = { ...values, subtitle: values.subtitle || null, author: values.author || null, updatedAt: new Date() };
  const [listing] = await db
    .insert(listings)
    .values({ projectId, ...row })
    .onConflictDoUpdate({ target: listings.projectId, set: row })
    .returning();
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  return serializeListing(listing);
}

/** Keywords from the organization's saved niches and recent lookups */
export async function keywordSuggestions({ project }: ProjectAccess): Promise<string[]> {
  const [saved, looked] = await Promise.all([
    db.select({ keyword: savedNiches.keyword }).from(savedNiches).where(eq(savedNiches.orgId, project.orgId)).orderBy(desc(savedNiches.createdAt)).limit(30),
    db.select({ keyword: keywordCache.keyword }).from(keywordCache).where(eq(keywordCache.orgId, project.orgId)).orderBy(desc(keywordCache.fetchedAt)).limit(30),
  ]);
  const seen = new Set<string>();
  return [...saved, ...looked]
    .map((r) => r.keyword.trim())
    .filter((k) => k && k.length <= 50 && !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()));
}
