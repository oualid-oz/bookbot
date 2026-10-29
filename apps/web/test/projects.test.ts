import { beforeAll, describe, expect, it } from 'vitest';
import { GET as listProjects, POST as createProject } from '@/app/api/projects/route';
import { DELETE as deleteProject, GET as getProject, PATCH as updateProject } from '@/app/api/projects/[id]/route';
import { GET as getCover, PUT as saveCover } from '@/app/api/projects/[id]/cover/route';
import { GET as listPuzzles, POST as addPuzzle } from '@/app/api/projects/[id]/puzzles/route';
import { DELETE as deletePuzzle } from '@/app/api/projects/[id]/puzzles/[puzzleId]/route';
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

  it("can't delete another project's puzzle", async () => {
    signInAs(alice);
    const ctx = params({ id: projectId });
    const { puzzles } = await json<{ puzzles: { id: string }[] }>(await listPuzzles(request('/x'), ctx));

    signInAs(bob);
    const res = await deletePuzzle(request('/x', { method: 'DELETE' }), params({ id: projectId, puzzleId: puzzles[0].id }));
    expect(res.status).toBe(404);
  });
});
