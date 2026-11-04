import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db, exports, projectDocs } from '@bookbot/db';
import { exportSpecSchema } from '@bookbot/shared';
import { serializeListing } from '@/server/listings';
import { countPuzzles, requireProjectAccess } from '@/server/projects';

/** What's done in each step of the project wizard */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/projects/[id]/progress'>) {
  const result = await requireProjectAccess((await ctx.params).id);
  if (!result.ok) return result.response;
  const { project, listing } = result.value;

  const [puzzles, docs, completed] = await Promise.all([
    countPuzzles(project.id),
    db.select({ kind: projectDocs.kind }).from(projectDocs).where(eq(projectDocs.projectId, project.id)),
    db.select({ spec: exports.spec }).from(exports).where(and(eq(exports.projectId, project.id), eq(exports.status, 'completed'))),
  ]);
  const { issues } = serializeListing(listing);
  const exported = new Set(completed.map((row) => exportSpecSchema.parse(row.spec ?? {}).kind));

  return NextResponse.json({
    puzzles,
    interiorSaved: docs.some((d) => d.kind === 'interior'),
    coverSaved: docs.some((d) => d.kind === 'cover'),
    listingErrors: issues.filter((i) => i.level === 'error').length,
    listingWarnings: issues.filter((i) => i.level === 'warning').length,
    interiorExported: exported.has('interior'),
    coverExported: exported.has('cover'),
  });
}
