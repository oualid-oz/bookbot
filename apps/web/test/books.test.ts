import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { bookSnapshots, db, trackedBooks } from '@bookbot/db';
import { POST as saveBook } from '@/app/api/ext/books/route';
import { GET as listBooks } from '@/app/api/books/route';
import { DELETE as deleteBook } from '@/app/api/books/[id]/route';
import { POST as createToken } from '@/app/api/extension/tokens/route';
import { DELETE as revokeToken } from '@/app/api/extension/tokens/[id]/route';
import { getRedis } from '@/server/redis';
import { createUser, json, params, request, resetDatabase, signInAs, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let aliceToken: string;
let aliceTokenId: string;
let bobToken: string;

interface Book {
  id: string;
  asin: string;
  title: string;
  bsr: number | null;
  estimatedDailySales: number | null;
  estimatedMonthlySales: number | null;
  url: string;
  history: { bsr: number | null }[];
}

async function tokenFor(user: TestUser) {
  signInAs(user);
  return json<{ token: string; record: { id: string } }>(await createToken(request('/x', { method: 'POST', body: {} })));
}

beforeAll(async () => {
  await resetDatabase();
  alice = await createUser('Alice');
  bob = await createUser('Bob');
  const a = await tokenFor(alice);
  aliceToken = a.token;
  aliceTokenId = a.record.id;
  bobToken = (await tokenFor(bob)).token;
});

afterAll(() => getRedis().disconnect());

const book = { asin: '1847941834', marketplace: 'UK', title: 'Atomic Habits', category: 'Books', bsr: 78, price: 9.56, reviews: 189284 };
const save = (token: string, body: unknown) =>
  saveBook(request('/api/ext/books', { method: 'POST', body, headers: { authorization: `Bearer ${token}` } }));

async function booksOf(user: TestUser) {
  signInAs(user);
  return (await json<{ books: Book[] }>(await listBooks(request('/api/books')))).books;
}

describe('saved books', () => {
  it('saves from the extension and shows up in the app with an estimate', async () => {
    expect((await save(aliceToken, book)).status).toBe(201);
    const [saved] = await booksOf(alice);
    expect(saved).toMatchObject({ asin: '1847941834', title: 'Atomic Habits', bsr: 78, url: 'https://www.amazon.co.uk/dp/1847941834' });
    expect(saved.estimatedDailySales).toBeGreaterThan(0);
    expect(saved.estimatedMonthlySales).toBe(saved.estimatedDailySales! * 30);
    expect(saved.history).toHaveLength(1);
  });

  it('updates the latest snapshot for quick repeat saves, and adds history later', async () => {
    await save(aliceToken, { ...book, bsr: 80 });
    let [saved] = await booksOf(alice);
    expect(saved.bsr).toBe(80);
    expect(saved.history.map((h) => h.bsr)).toEqual([80]);

    // Pretend the last save was an hour ago
    await db.update(bookSnapshots).set({ capturedAt: new Date(Date.now() - 60 * 60 * 1000) }).where(eq(bookSnapshots.bookId, saved.id));
    await save(aliceToken, { ...book, bsr: 65 });
    [saved] = await booksOf(alice);
    expect(saved.history.map((h) => h.bsr)).toEqual([80, 65]);
    expect(await db.select().from(trackedBooks)).toHaveLength(1);
  });

  it('keeps each org to its own books', async () => {
    await save(bobToken, { ...book, title: "Bob's copy" });
    const [bobs] = await booksOf(bob);
    expect(bobs.title).toBe("Bob's copy");
    expect((await booksOf(alice))[0].title).toBe('Atomic Habits');

    signInAs(alice);
    expect((await deleteBook(request('/x', { method: 'DELETE' }), params({ id: bobs.id }))).status).toBe(404);
    signInAs(bob);
    expect((await deleteBook(request('/x', { method: 'DELETE' }), params({ id: bobs.id }))).status).toBe(204);
    expect(await booksOf(bob)).toEqual([]);
    expect(await booksOf(alice)).toHaveLength(1);
  });

  it('saves books without a sales model, with no estimate', async () => {
    expect((await save(aliceToken, { asin: 'B0TOYGAME1', marketplace: 'US', title: 'A board game', category: 'Toys & Games', bsr: 500 })).status).toBe(201);
    const game = (await booksOf(alice)).find((b) => b.asin === 'B0TOYGAME1');
    expect(game).toMatchObject({ bsr: 500, estimatedDailySales: null, estimatedMonthlySales: null });
  });

  it('validates input', async () => {
    expect((await save(aliceToken, { ...book, asin: 'not-an-asin' })).status).toBe(400);
    expect((await save(aliceToken, { ...book, marketplace: 'XX' })).status).toBe(400);
    expect((await save(aliceToken, { ...book, title: '' })).status).toBe(400);
  });

  it('needs a valid token to save, and a session to list', async () => {
    expect((await save('bbx_invalid', book)).status).toBe(401);
    signInAs(alice);
    await revokeToken(request('/x', { method: 'DELETE' }), params({ id: aliceTokenId }));
    expect((await save(aliceToken, book)).status).toBe(401);
    signInAs(null);
    expect((await listBooks(request('/api/books'))).status).toBe(401);
  });
});
