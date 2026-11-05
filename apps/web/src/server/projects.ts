import { randomBytes } from 'node:crypto';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { db, exports, listings, projectDocs, projects, puzzleSets } from '@bookbot/db';
import {
  generateCrossword,
  generateMaze,
  generateSudoku,
  generateThemedWordSearches,
  generateWordSearch,
  type CrosswordResult,
  type MazeResult,
  type SudokuResult,
  type WordThemeId,
} from '@bookbot/puzzles';
import {
  coverDesignSchema,
  interiorSettingsSchema,
  type CoverDesign,
  type InteriorSettings,
  type ProjectCreateInput,
  type projectUpdateSchema,
  type PuzzleCreateInput,
} from '@bookbot/shared';
import type { z } from 'zod';
import { errorResponse, isUuid, requireOrgAccess, type OrgAccess } from './org-access';
import { deleteStoredFiles } from './stored-files';
import { deleteUnusedImages, imageIdsInDoc } from './assets';

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
  const [cover, interior] = await Promise.all([previousImages(projectId, 'cover'), previousImages(projectId, 'interior')]);
  await db.delete(projects).where(eq(projects.id, projectId));
  await deleteStoredFiles(files.map((f) => f.key));
  // Its images too, unless another project uses them
  await deleteDroppedImages(projectId, { orgId: cover.orgId, ids: [...cover.ids, ...interior.ids] }, []);
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
  const before = await previousImages(projectId, 'cover');
  const [doc] = await db
    .insert(projectDocs)
    .values({ projectId, kind: 'cover', jsonState: design, version: 1 })
    .onConflictDoUpdate({
      target: [projectDocs.projectId, projectDocs.kind],
      set: { jsonState: design, version: sql`${projectDocs.version} + 1`, updatedAt: new Date() },
    })
    .returning({ version: projectDocs.version, updatedAt: projectDocs.updatedAt });

  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  await deleteDroppedImages(projectId, before, imageIdsInDoc(design));
  return doc;
}

/** The project's org and the images its saved document uses, before a save */
async function previousImages(projectId: string, kind: 'cover' | 'interior') {
  const [row] = await db
    .select({ orgId: projects.orgId, jsonState: projectDocs.jsonState })
    .from(projects)
    .leftJoin(projectDocs, and(eq(projectDocs.projectId, projects.id), eq(projectDocs.kind, kind)))
    .where(eq(projects.id, projectId));
  return { orgId: row?.orgId ?? null, ids: imageIdsInDoc(row?.jsonState) };
}

/** Delete images a save stopped using, unless something else still uses them */
async function deleteDroppedImages(projectId: string, before: { orgId: string | null; ids: string[] }, after: string[]) {
  const dropped = before.ids.filter((id) => !after.includes(id));
  if (before.orgId && dropped.length) {
    await deleteUnusedImages(before.orgId, dropped).catch((err) => console.error(`Could not clean up images of project ${projectId}:`, err));
  }
}

// ---- Interior settings ----

export async function getInteriorSettings(projectId: string): Promise<InteriorSettings> {
  const [doc] = await db
    .select({ jsonState: projectDocs.jsonState })
    .from(projectDocs)
    .where(and(eq(projectDocs.projectId, projectId), eq(projectDocs.kind, 'interior')))
    .limit(1);
  const parsed = interiorSettingsSchema.safeParse(doc?.jsonState ?? {});
  return parsed.success ? parsed.data : interiorSettingsSchema.parse({});
}

export async function saveInteriorSettings(projectId: string, settings: InteriorSettings) {
  const before = await previousImages(projectId, 'interior');
  await db
    .insert(projectDocs)
    .values({ projectId, kind: 'interior', jsonState: settings, version: 1 })
    .onConflictDoUpdate({
      target: [projectDocs.projectId, projectDocs.kind],
      set: { jsonState: settings, version: sql`${projectDocs.version} + 1`, updatedAt: new Date() },
    });
  await db.update(projects).set({ updatedAt: new Date() }).where(eq(projects.id, projectId));
  await deleteDroppedImages(projectId, before, imageIdsInDoc(settings));
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
  if (row.type === 'crossword') {
    const content = row.content as CrosswordResult;
    return {
      ...base,
      width: content.width,
      height: content.height,
      words: content.entries.map((e) => e.answer),
      unplaced: content.unplaced,
    };
  }
  if (row.type === 'maze') {
    const content = row.content as MazeResult;
    return { ...base, width: content.width, height: content.height };
  }
  const content = row.content as { title?: string; solution: { word: string }[]; unplaced?: string[] };
  const params = row.params as { width: number; height: number };
  return {
    ...base,
    width: params.width,
    height: params.height,
    title: content.title ?? null,
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
      case 'word_search_theme':
        throw new Error('Themed word searches are generated together');
      case 'sudoku':
        return { params: { difficulty: input.difficulty }, content: generateSudoku(seed, input.difficulty) };
      case 'maze':
        return { params: { width: input.width, height: input.height }, content: generateMaze(seed, input.width, input.height) };
      case 'crossword':
        return { params: { entries: input.entries }, content: generateCrossword(input.entries, seed) };
      case 'word_search':
        return {
          params: { words: input.words, width: input.width, height: input.height },
          content: generateWordSearch(input.words, seed, input.width, input.height),
        };
    }
  };

  let values;
  if (input.type === 'word_search_theme') {
    const seed = randomBytes(8).toString('hex');
    const theme = input.theme as WordThemeId;
    values = generateThemedWordSearches(theme, input.count, seed, input.size).map((content, i) => ({
      projectId,
      type: 'word_search' as const,
      seed: `${seed}:${i}`,
      params: { theme, title: content.title, width: input.size, height: input.size },
      content,
    }));
  } else {
    const total = input.type === 'word_search' || input.type === 'crossword' ? 1 : input.count;
    values = Array.from({ length: total }, () => {
      const seed = randomBytes(8).toString('hex');
      return { projectId, type: input.type, seed, ...generate(seed) };
    });
  }

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
