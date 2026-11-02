import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { assets, db, projects, puzzleSets, savedNiches } from '@bookbot/db';
import { GET as listProjects, POST as createProject } from '@/app/api/projects/route';
import { DELETE as deleteProject, GET as getProject, PATCH as updateProject } from '@/app/api/projects/[id]/route';
import { GET as getCover, PUT as saveCover } from '@/app/api/projects/[id]/cover/route';
import { GET as listPuzzles, POST as addPuzzle } from '@/app/api/projects/[id]/puzzles/route';
import { DELETE as deletePuzzle } from '@/app/api/projects/[id]/puzzles/[puzzleId]/route';
import { GET as getInterior, PUT as saveInterior } from '@/app/api/projects/[id]/interior/route';
import { GET as getListing, PUT as saveListing } from '@/app/api/projects/[id]/listing/route';
import { createUser, json, params, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let projectId: string;

const newProject = { title: 'Animal Word Search', type: 'puzzle_book', trimSize: '6x9', pageCount: 100 };

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
  signInAs(alice);
  const res = await createProject(request('/api/projects', { method: 'POST', body: newProject }));
  projectId = (await json<{ project: { id: string } }>(res)).project.id;
});

describe('projects', () => {
  it('validates specs', async () => {
    signInAs(alice);
    const res = await createProject(request('/api/projects', { method: 'POST', body: { ...newProject, trimSize: '9x99', pageCount: 10 } }));
    expect(res.status).toBe(400);
    const { fields } = await json<{ fields: Record<string, string[]> }>(res);
    expect(Object.keys(fields).sort()).toEqual(['pageCount', 'trimSize']);
  });

  it('enforces the free plan project limit', async () => {
    signInAs(bob);
    const create = () => createProject(request('/api/projects', { method: 'POST', body: newProject }));
    const statuses = [];
    for (let i = 0; i < 4; i++) statuses.push((await create()).status);
    expect(statuses).toEqual([201, 201, 201, 429]);
  });

  it("can't be read, changed, or deleted from another org", async () => {
    signInAs(bob);
    const ctx = params({ id: projectId });
    expect((await getProject(request(`/api/projects/${projectId}`), ctx)).status).toBe(404);
    expect((await updateProject(request(`/api/projects/${projectId}`, { method: 'PATCH', body: { title: 'x' } }), ctx)).status).toBe(404);
    expect((await deleteProject(request(`/api/projects/${projectId}`, { method: 'DELETE' }), ctx)).status).toBe(404);
    expect((await saveCover(request('/x', { method: 'PUT', body: {} }), ctx)).status).toBe(404);
    expect((await addPuzzle(request('/x', { method: 'POST', body: { words: ['cat'] } }), ctx)).status).toBe(404);

    const { projects } = await json<{ projects: { id: string }[] }>(await listProjects(request('/api/projects')));
    expect(projects.map((p) => p.id)).not.toContain(projectId);
  });

  it('returns 401 before revealing whether a project exists', async () => {
    signInAs(null);
    expect((await getProject(request('/x'), params({ id: projectId }))).status).toBe(401);
  });

  it('updates title and specs', async () => {
    signInAs(alice);
    const res = await updateProject(
      request(`/api/projects/${projectId}`, { method: 'PATCH', body: { title: 'Animals Vol 1', pageCount: 120 } }),
      params({ id: projectId })
    );
    expect(res.status).toBe(200);
    const { project } = await json<{ project: { title: string; pageCount: number } }>(res);
    expect(project).toMatchObject({ title: 'Animals Vol 1', pageCount: 120 });
  });
});

describe('cover design', () => {
  it('defaults to the project title, then saves with a version bump', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const initial = await json<{ design: { title: string }; version: number }>(await getCover(request('/x'), ctx));
    expect(initial.version).toBe(0);
    expect(initial.design.title).toBe('Animals Vol 1');

    const design = { ...initial.design, author: 'Jane Doe', backgroundColor: '#0f766e' };
    const first = await json<{ version: number }>(await saveCover(request('/x', { method: 'PUT', body: design }), ctx));
    const second = await json<{ version: number }>(await saveCover(request('/x', { method: 'PUT', body: design }), ctx));
    expect([first.version, second.version]).toEqual([1, 2]);

    const saved = await json<{ design: { author: string } }>(await getCover(request('/x'), ctx));
    expect(saved.design.author).toBe('Jane Doe');
  });

  it('rejects invalid colors', async () => {
    signInAs(alice);
    const res = await saveCover(request('/x', { method: 'PUT', body: { backgroundColor: 'red' } }), params({ id: projectId }));
    expect(res.status).toBe(400);
  });
});

describe('puzzles', () => {
  it('reports words that did not fit', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const res = await addPuzzle(
      request('/x', { method: 'POST', body: { words: ['cat', 'Dog', 'fish!', 'hippopotamuses'], width: 10, height: 10 } }),
      ctx
    );
    expect(res.status).toBe(201);
    const { puzzle } = await json<{ puzzle: { id: string; words: string[]; unplaced: string[] } }>(res);
    expect(puzzle.unplaced).toEqual(['HIPPOPOTAMUSES']);
    expect(puzzle.words.sort()).toEqual(['CAT', 'DOG', 'FISH']);

    const { puzzles } = await json<{ puzzles: { unplaced: string[] }[] }>(await listPuzzles(request('/x'), ctx));
    expect(puzzles[0].unplaced).toEqual(['HIPPOPOTAMUSES']);
  });

  it('rejects word lists with no letters', async () => {
    signInAs(alice);
    const res = await addPuzzle(request('/x', { method: 'POST', body: { words: ['123', '!!'] } }), params({ id: projectId }));
    expect(res.status).toBe(400);
  });

  it('adds several sudoku at once, in order, with the chosen difficulty', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const res = await addPuzzle(request('/x', { method: 'POST', body: { type: 'sudoku', difficulty: 'easy', count: 3 } }), ctx);
    expect(res.status).toBe(201);
    const { puzzles: added } = await json<{ puzzles: { id: string; type: string; difficulty: string; clues: number }[] }>(res);
    expect(added).toHaveLength(3);
    expect(added.every((p) => p.type === 'sudoku' && p.difficulty === 'easy' && p.clues === 40)).toBe(true);
    // Each one is a different puzzle
    const rows = await db.select().from(puzzleSets).where(eq(puzzleSets.type, 'sudoku'));
    expect(new Set(rows.map((r) => JSON.stringify((r.content as { puzzle: number[][] }).puzzle))).size).toBe(3);

    const { puzzles } = await json<{ puzzles: { id: string }[] }>(await listPuzzles(request('/x'), ctx));
    expect(puzzles.slice(-3).map((p) => p.id)).toEqual(added.map((p) => p.id));
  });

  it('adds mazes of the chosen size', async () => {
    signInAs(alice);
    const res = await addPuzzle(
      request('/x', { method: 'POST', body: { type: 'maze', width: 10, height: 12 } }),
      params({ id: projectId })
    );
    expect(res.status).toBe(201);
    const { puzzle } = await json<{ puzzle: { type: string; width: number; height: number } }>(res);
    expect(puzzle).toMatchObject({ type: 'maze', width: 10, height: 12 });
  });

  it('adds themed word searches, one topic per puzzle', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const res = await addPuzzle(request('/x', { method: 'POST', body: { type: 'word_search_theme', theme: 'holidays', size: 15, count: 4 } }), ctx);
    expect(res.status).toBe(201);
    const { puzzles } = await json<{ puzzles: { type: string; title: string; words: string[]; width: number }[] }>(res);
    expect(puzzles).toHaveLength(4);
    expect(new Set(puzzles.map((p) => p.title)).size).toBe(4);
    expect(puzzles.every((p) => p.type === 'word_search' && p.width === 15 && p.words.length >= 15)).toBe(true);

    const unknown = await addPuzzle(request('/x', { method: 'POST', body: { type: 'word_search_theme', theme: 'nope' } }), ctx);
    expect(unknown.status).toBe(400);
  });

  it('adds a crossword from words and clues', async () => {
    signInAs(alice);
    const entries = [
      ['elephant', 'Largest land animal'], ['giraffe', 'Tallest animal'], ['penguin', 'Swimming bird'],
      ['tiger', 'Striped big cat'], ['zebra', 'Striped horse'], ['rabbit', 'Long-eared hopper'],
    ].map(([answer, clue]) => ({ answer, clue }));
    const res = await addPuzzle(request('/x', { method: 'POST', body: { type: 'crossword', entries } }), params({ id: projectId }));
    expect(res.status).toBe(201);
    const { puzzle } = await json<{ puzzle: { type: string; words: string[]; unplaced: string[] } }>(res);
    expect(puzzle.type).toBe('crossword');
    expect([...puzzle.words, ...puzzle.unplaced].sort()).toEqual(['ELEPHANT', 'GIRAFFE', 'PENGUIN', 'RABBIT', 'TIGER', 'ZEBRA']);
    const [row] = await db.select().from(puzzleSets).where(eq(puzzleSets.type, 'crossword'));
    expect((row.content as { entries: { clue: string }[] }).entries.map((e) => e.clue)).toContain('Striped big cat');
  });

  it('rejects crosswords without enough words or clues', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const few = [{ answer: 'cat', clue: 'Pet' }, { answer: 'dog', clue: 'Pet' }, { answer: 'owl', clue: 'Bird' }];
    expect((await addPuzzle(request('/x', { method: 'POST', body: { type: 'crossword', entries: few } }), ctx)).status).toBe(400);
    const dupes = [...few, { answer: 'CAT!', clue: 'Again' }];
    expect((await addPuzzle(request('/x', { method: 'POST', body: { type: 'crossword', entries: dupes } }), ctx)).status).toBe(400);
    const noClue = [...few, { answer: 'emu', clue: ' ' }];
    expect((await addPuzzle(request('/x', { method: 'POST', body: { type: 'crossword', entries: noClue } }), ctx)).status).toBe(400);
  });

  it('validates puzzle options', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const bad = [
      { type: 'sudoku', difficulty: 'impossible' },
      { type: 'sudoku', count: 51 },
      { type: 'maze', width: 2 },
      { type: 'crossword' },
      { type: 'jigsaw' },
    ];
    for (const body of bad) {
      expect((await addPuzzle(request('/x', { method: 'POST', body }), ctx)).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('caps the number of puzzles in a project', async () => {
    signInAs(alice);
    const [project] = await db
      .insert(projects)
      .values({ orgId: alice.orgId, title: 'Big book', type: 'puzzle_book', trimSize: '6x9', pageCount: 24 })
      .returning();
    const ctx = params({ id: project.id });
    const add = (count: number) => addPuzzle(request('/x', { method: 'POST', body: { type: 'maze', width: 5, height: 5, count } }), ctx);
    for (let i = 0; i < 6; i++) expect((await add(50)).status).toBe(201);
    expect((await add(1)).status).toBe(400);
  });

  it("can't delete another project's puzzle", async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const { puzzles } = await json<{ puzzles: { id: string }[] }>(await listPuzzles(request('/x'), ctx));

    signInAs(bob);
    const res = await deletePuzzle(request('/x', { method: 'DELETE' }), params({ id: projectId, puzzleId: puzzles[0].id }));
    expect(res.status).toBe(404);
  });
});

describe('interior settings', () => {
  it('starts with defaults, saves changes and validates them', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const initial = await json<{ settings: Record<string, unknown> }>(await getInterior(request('/x'), ctx));
    expect(initial.settings).toEqual({
      version: 1,
      solutions: 'back',
      howToPlay: true,
      largePrint: false,
      lineSpacing: 'wide',
      typography: { headingFont: 'helvetica', bodyFont: 'helvetica', puzzleFont: 'courier', headingColor: '#000000', textColor: '#000000' },
      decor: {
        border: 'none',
        borderColor: '#333333',
        background: 'none',
        backgroundColor: '#888888',
        intensity: 'light',
        imageId: null,
        imageMode: 'frame',
        imageOpacity: 0.2,
      },
    });

    const body = { solutions: 'none', largePrint: true, pageTemplate: 'daily_planner', lineSpacing: 'college' };
    expect((await saveInterior(request('/x', { method: 'PUT', body }), ctx)).status).toBe(200);
    const after = await json<{ settings: Record<string, unknown> }>(await getInterior(request('/x'), ctx));
    expect(after.settings).toMatchObject(body);

    const bad = await saveInterior(request('/x', { method: 'PUT', body: { pageTemplate: 'wallpaper' } }), ctx);
    expect(bad.status).toBe(400);
  });

  it('saves fonts and colors, keeping decorative fonts for titles only', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const save = (typography: Record<string, unknown>) => saveInterior(request('/x', { method: 'PUT', body: { typography } }), ctx);

    const chosen = { headingFont: 'lobster', bodyFont: 'lato', puzzleFont: 'comicneue', headingColor: '#be123c', textColor: '#1f2937' };
    expect((await save(chosen)).status).toBe(200);
    const { settings } = await json<{ settings: { typography: Record<string, unknown> } }>(await getInterior(request('/x'), ctx));
    expect(settings.typography).toEqual(chosen);

    expect((await save({ bodyFont: 'lobster' })).status).toBe(400);
    expect((await save({ puzzleFont: 'pacifico' })).status).toBe(400);
    expect((await save({ headingFont: 'wingdings' })).status).toBe(400);
    expect((await save({ headingColor: 'red' })).status).toBe(400);
  });

  it('saves page decorations and only accepts your own finished images', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const image = (orgId: string, status: 'pending' | 'ready') =>
      db.insert(assets).values({ orgId, r2Key: `assets/${orgId}/${status}-${Math.random()}.png`, kind: 'image', status, mimeType: 'image/png', width: 1800, height: 2700 }).returning();
    const [mine] = await image(alice.orgId, 'ready');
    const [pending] = await image(alice.orgId, 'pending');
    const [theirs] = await image(bob.orgId, 'ready');
    const save = (decor: Record<string, unknown>) => saveInterior(request('/x', { method: 'PUT', body: { decor } }), ctx);

    const res = await save({ border: 'wavy', borderColor: '#7c3aed', background: 'confetti', intensity: 'medium', imageId: mine.id, imageMode: 'watermark' });
    expect(res.status).toBe(200);
    const { settings, image: info } = await json<{ settings: { decor: Record<string, unknown> }; image: { id: string; width: number } }>(
      await getInterior(request('/x'), ctx)
    );
    expect(settings.decor).toMatchObject({ border: 'wavy', background: 'confetti', imageId: mine.id, imageMode: 'watermark' });
    expect(info).toMatchObject({ id: mine.id, width: 1800 });

    expect((await save({ imageId: theirs.id })).status).toBe(400);
    expect((await save({ imageId: pending.id })).status).toBe(400);
    expect((await save({ border: 'sparkles' })).status).toBe(400);
    expect((await save({ borderColor: 'purple' })).status).toBe(400);
  });

  it("hides other organizations' projects", async () => {
    signInAs(bob);
    const ctx = params({ id: projectId });
    expect((await getInterior(request('/x'), ctx)).status).toBe(404);
    expect((await saveInterior(request('/x', { method: 'PUT', body: {} }), ctx)).status).toBe(404);
  });
});

describe('listing', () => {
  type ListingResponse = { listing: Record<string, unknown>; issues: { field: string; level: string }[]; suggestions: string[] };

  it('saves the listing, reports KDP problems and suggests saved keywords', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    await db.insert(savedNiches).values({ orgId: alice.orgId, keyword: 'farm animal puzzles' });

    const current = await json<{ project: { title: string } }>(await getProject(request('/x'), ctx));
    const before = await json<ListingResponse>(await getListing(request('/x'), ctx));
    expect(before.listing.title).toBe(current.project.title);
    expect(before.issues.some((i) => i.field === 'author' && i.level === 'error')).toBe(true);
    expect(before.suggestions).toContain('farm animal puzzles');

    const body = {
      title: 'Animal Word Search',
      subtitle: 'Bestseller puzzles for kids',
      author: 'Maya Brooks',
      description: '<p>Fun puzzles.</p>',
      keywords: ['farm animal puzzles', 'gift for kids'],
      categories: ['Games › Word Search'],
    };
    const res = await saveListing(request('/x', { method: 'PUT', body }), ctx);
    expect(res.status).toBe(200);
    const saved = await json<ListingResponse>(res);
    expect(saved.listing).toMatchObject(body);
    expect(saved.issues.filter((i) => i.level === 'error').map((i) => i.field)).toEqual(['subtitle']);

    // The project title follows the listing
    const { project } = await json<{ project: { title: string; subtitle: string } }>(await getProject(request('/x'), ctx));
    expect(project).toMatchObject({ title: 'Animal Word Search', subtitle: body.subtitle });
  });

  it('validates input and hides other organizations', async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    expect((await saveListing(request('/x', { method: 'PUT', body: { title: '' } }), ctx)).status).toBe(400);
    expect((await saveListing(request('/x', { method: 'PUT', body: { title: 'x', keywords: Array(8).fill('k') } }), ctx)).status).toBe(400);
    signInAs(bob);
    expect((await getListing(request('/x'), ctx)).status).toBe(404);
  });
});
