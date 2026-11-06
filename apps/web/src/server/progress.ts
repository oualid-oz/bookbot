import { and, eq } from 'drizzle-orm';
import { db, exports, listings, projectDocs } from '@bookbot/db';
import { exportSpecSchema } from '@bookbot/shared';
import type { ProjectProgress } from '@/components/project-steps';
import { serializeListing } from './listings';
import { countPuzzles } from './projects';

/** What's done in each step of a project */
export async function getProjectProgress(projectId: string, listing: typeof listings.$inferSelect | null): Promise<ProjectProgress> {
  const [puzzles, docs, completed] = await Promise.all([
    countPuzzles(projectId),
    db.select({ kind: projectDocs.kind }).from(projectDocs).where(eq(projectDocs.projectId, projectId)),
    db.select({ spec: exports.spec }).from(exports).where(and(eq(exports.projectId, projectId), eq(exports.status, 'completed'))),
  ]);
  const { issues } = serializeListing(listing);
  const exported = new Set(completed.map((row) => exportSpecSchema.parse(row.spec ?? {}).kind));

  return {
    puzzles,
    interiorSaved: docs.some((d) => d.kind === 'interior'),
    coverSaved: docs.some((d) => d.kind === 'cover'),
    listingErrors: issues.filter((i) => i.level === 'error').length,
    listingWarnings: issues.filter((i) => i.level === 'warning').length,
    interiorExported: exported.has('interior'),
    coverExported: exported.has('cover'),
  };
}
