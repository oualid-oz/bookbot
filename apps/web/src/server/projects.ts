import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db, exports, listings, projectDocs, projects, puzzleSets } from '@bookbot/db';
import { generateMaze, generateSudoku, generateWordSearch, type MazeResult, type SudokuResult } from '@bookbot/puzzles';
import {
  coverDesignSchema,
  type CoverDesign,
  type ProjectCreateInput,
  type projectUpdateSchema,
  type PuzzleCreateInput,
} from '@bookbot/shared';
import type { z } from 'zod';
import { errorResponse, isUuid, requireOrgAccess, type OrgAccess } from './org-access';
import { deleteStoredFiles } from './stored-files';

type Project = typeof projects.$inferSelect;
type Listing = typeof listings.$inferSelect;

export interface ProjectAccess {
  access: OrgAccess;
  project: Project;
  listing: Listing | null;
}

/**
 * Load a project the signed-in user can access. Projects in other orgs, and
 * missing ones, both return 404.
 */
export async function requireProjectAccess(projectId: string) {
  if (!isUuid(projectId)) {
    return { ok: false as const, response: errorResponse(400, 'Invalid project id') };
  }

  const [row] = await db
    .select({ project: projects, listing: listings })
    .from(projects)
    .leftJoin(listings, eq(listings.projectId, projects.id))
    .where(eq(projects.id, projectId))
    .limit(1);

  const access = await requireOrgAccess(row?.project.orgId);
  // Unauthenticated callers get 401 before learning whether the project exists
  if (!access.ok && access.response.status === 401) return access;
  if (!row || !access.ok) {
    return { ok: false as const, response: errorResponse(404, 'Project not found') };
  }

  return { ok: true as const, value: { access: access.value, project: row.project, listing: row.listing } };
}

export function serializeProject(project: Project, listing: Listing | null) {
  return {
    id: project.id,
    orgId: project.orgId,
    title: listing?.title ?? 'Untitled book',
    subtitle: listing?.subtitle ?? null,
    type: project.type,
    trimSize: project.trimSize,
    pageCount: project.pageCount,
    paper: project.paper,
    status: project.status,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
  };
}

export async function listProjects(orgId: string) {
  const rows = await db
    .select({ project: projects, listing: listings })
    .from(projects)
    .leftJoin(listings, eq(listings.projectId, projects.id))
    .where(eq(projects.orgId, orgId))
    .orderBy(desc(projects.updatedAt));
  return rows.map((r) => serializeProject(r.project, r.listing));
}

export async function countProjects(orgId: string) {
  const [row] = await db.select({ n: count() }).from(projects).where(eq(projects.orgId, orgId));
  return row.n;
}

export async function createProject(orgId: string, input: ProjectCreateInput) {
  return db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        orgId,
        type: input.type,
        trimSize: input.trimSize,
        pageCount: input.pageCount,
        paper: input.paper,
      })
      .returning();

    const [listing] = await tx
      .insert(listings)
      .values({ projectId: project.id, title: input.title, subtitle: input.subtitle || null, description: '', keywords: [] })
      .returning();

    return serializeProject(project, listing);
  });
}

export async function updateProject(
  { project, listing }: ProjectAccess,
  patch: z.infer<typeof projectUpdateSchema>
) {
  return db.transaction(async (tx) => {
    const { title, subtitle, ...specs } = patch;

    const [updated] = await tx
      .update(projects)
      .set({ ...specs, updatedAt: new Date() })
      .where(eq(projects.id, project.id))
      .returning();

    let updatedListing = listing;
    if (title !== undefined || subtitle !== undefined) {
      const values = {
        title: title ?? listing?.title ?? 'Untitled book',
        subtitle: subtitle === undefined ? (listing?.subtitle ?? null) : subtitle || null,
      };
      [updatedListing] = await tx
        .insert(listings)
        .values({ projectId: project.id, description: '', keywords: [], ...values })
        .onConflictDoUpdate({ target: listings.projectId, set: { ...values, updatedAt: new Date() } })
        .returning();
    }

    return serializeProject(updated, updatedListing);
  });
}

export async function deleteProject(projectId: string) {
  const files = await db.select({ key: exports.r2Key }).from(exports).where(eq(exports.projectId, projectId));
  await db.delete(projects).where(eq(projects.id, projectId));
  await deleteStoredFiles(files.map((f) => f.key));
}

// ---- Cover design ----

/**
 * Saved cover design, or a default one prefilled from the listing
 */
export async function getCoverDesign({ project, listing }: ProjectAccess): Promise<{ design: CoverDesign; version: number }> {
  const [doc] = await db
    .select()
    .from(projectDocs)
    .where(and(eq(projectDocs.projectId, project.id), eq(projectDocs.kind, 'cover')))
    .limit(1);

  const parsed = coverDesignSchema.safeParse(doc?.jsonState ?? {});
  const design = parsed.success ? parsed.data : coverDesignSchema.parse({});
  if (!doc) {
    design.title = listing?.title ?? '';
    design.subtitle = listing?.subtitle ?? '';
  }
  return { design, version: doc?.version ?? 0 };
}

export async function saveCoverDesign(projectId: string, design: CoverDesign) {
  const [doc] = await db
    .insert(projectDocs)
    .values({ projectId, kind: 'cover', jsonState: design, version: 1 })
    .onConflictDoUpdate({
      target: [projectDocs.projectId, projectDocs.kind],
      set: { jsonState: design, version: sql`${projectDocs.version} + 1`, updatedAt: new Date() },
    })
    .returning({ version: projectDocs.version, updatedAt: projectDocs.updatedAt });

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  return doc;
}

// ---- Puzzles ----

/** Upper limit per project, far above what fits in a 828-page KDP book */
export const MAX_PUZZLES_PER_PROJECT = 300;

type PuzzleRow = typeof puzzleSets.$inferSelect;

/** Summary of a puzzle for the project page */
function serializePuzzle(row: PuzzleRow) {
  const base = { id: row.id, type: row.type, createdAt: row.createdAt };
  if (row.type === 'sudoku') {
    const content = row.content as SudokuResult;
    return { ...base, difficulty: content.difficulty, clues: content.clues };
  }
  if (row.type === 'maze') {
    const content = row.content as MazeResult;
    return { ...base, width: content.width, height: content.height };
  }
  const content = row.content as { solution: { word: string }[]; unplaced?: string[] };
  const params = row.params as { width: number; height: number };
  return {
    ...base,
    width: params.width,
    height: params.height,
    words: content.solution.map((s) => s.word),
    unplaced: content.unplaced ?? [],
  };
}

export async function listPuzzles(projectId: string) {
  const rows = await db
    .select()
    .from(puzzleSets)
    .where(eq(puzzleSets.projectId, projectId))
    .orderBy(puzzleSets.createdAt);
  return rows.map(serializePuzzle);
}

export async function countPuzzles(projectId: string) {
  const [row] = await db.select({ n: count() }).from(puzzleSets).where(eq(puzzleSets.projectId, projectId));
  return row.n;
}

/** Generate and store puzzles; sudoku and mazes can be made several at a time */
export async function addPuzzles(projectId: string, input: PuzzleCreateInput) {
  const generate = (seed: string) => {
    switch (input.type) {
      case 'sudoku':
        return { params: { difficulty: input.difficulty }, content: generateSudoku(seed, input.difficulty) };
      case 'maze':
        return { params: { width: input.width, height: input.height }, content: generateMaze(seed, input.width, input.height) };
      case 'word_search':
        return {
          params: { words: input.words, width: input.width, height: input.height },
          content: generateWordSearch(input.words, seed, input.width, input.height),
        };
    }
  };

  const total = input.type === 'word_search' ? 1 : input.count;
  const values = Array.from({ length: total }, () => {
    const seed = randomBytes(8).toString('hex');
    return { projectId, type: input.type, seed, ...generate(seed) };
  });

  // Insert one at a time so createdAt keeps them in order
  const rows: PuzzleRow[] = [];
  await db.transaction(async (tx) => {
    for (const value of values) {
      const [row] = await tx.insert(puzzleSets).values({ ...value, createdAt: new Date(Date.now() + rows.length) }).returning();
      rows.push(row);
    }
  });
  return rows.map(serializePuzzle);
}

export async function deletePuzzle(projectId: string, puzzleId: string) {
  const deleted = await db
    .delete(puzzleSets)
    .where(and(eq(puzzleSets.projectId, projectId), eq(puzzleSets.id, puzzleId)))
    .returning({ id: puzzleSets.id });
  return deleted.length > 0;
}

// ---- Exports ----

export async function listExports(projectId: string) {
  const rows = await db
    .select()
    .from(exports)
    .where(eq(exports.projectId, projectId))
    .orderBy(desc(exports.createdAt))
    .limit(20);

  return rows.map(({ r2Key, ...row }) => ({
    ...row,
    downloadUrl: row.status === 'completed' && r2Key ? `/api/export/${row.id}/download` : null,
  }));
}
