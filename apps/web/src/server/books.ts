import { and, desc, eq, inArray } from 'drizzle-orm';
import { bookSnapshots, db, trackedBooks } from '@bookbot/db';
import { estimateSalesFromBSR, getBSRCurve } from '@bookbot/core';
import type { SaveBookInput } from '@bookbot/shared';

/** Saves this close together update the latest snapshot instead of adding one */
const SNAPSHOT_MERGE_WINDOW_MS = 10 * 60 * 1000;
/** History points returned per book */
const HISTORY_POINTS = 30;

const AMAZON_HOSTS = {
  US: 'www.amazon.com',
  UK: 'www.amazon.co.uk',
  DE: 'www.amazon.de',
  FR: 'www.amazon.fr',
  ES: 'www.amazon.es',
  IT: 'www.amazon.it',
  JP: 'www.amazon.co.jp',
} as const;

/** Estimated daily sales, or null when there's no model for the category */
export function estimateDailySales(bsr: number | undefined, category: string | undefined, marketplace: string): number | null {
  if (!bsr || !category) return null;
  const curve = getBSRCurve(category, marketplace);
  return curve ? Math.round(estimateSalesFromBSR(bsr, curve.params)) : null;
}

/**
 * Save a book for an org and record a snapshot of its current numbers
 */
export async function saveBook(orgId: string, input: SaveBookInput) {
  const now = new Date();
  const values = {
    title: input.title,
    category: input.category ?? null,
    bsr: input.bsr ?? null,
    price: input.price === undefined ? null : input.price.toFixed(2),
    reviews: input.reviews ?? null,
    estimatedDailySales: estimateDailySales(input.bsr, input.category, input.marketplace),
  };

  return db.transaction(async (tx) => {
    const [book] = await tx
      .insert(trackedBooks)
      .values({ orgId, asin: input.asin, marketplace: input.marketplace, ...values, lastCheckedAt: now })
      .onConflictDoUpdate({
        target: [trackedBooks.orgId, trackedBooks.asin, trackedBooks.marketplace],
        set: { ...values, lastCheckedAt: now },
      })
      .returning();

    const snapshot = { bsr: values.bsr, category: values.category, price: values.price, reviews: values.reviews, estimatedDailySales: values.estimatedDailySales };
    const [latest] = await tx
      .select({ id: bookSnapshots.id, capturedAt: bookSnapshots.capturedAt })
      .from(bookSnapshots)
      .where(eq(bookSnapshots.bookId, book.id))
      .orderBy(desc(bookSnapshots.capturedAt))
      .limit(1);

    if (latest && now.getTime() - latest.capturedAt.getTime() < SNAPSHOT_MERGE_WINDOW_MS) {
      await tx.update(bookSnapshots).set({ ...snapshot, capturedAt: now }).where(eq(bookSnapshots.id, latest.id));
    } else {
      await tx.insert(bookSnapshots).values({ bookId: book.id, ...snapshot, capturedAt: now });
    }

    return serializeBook(book);
  });
}

type Book = typeof trackedBooks.$inferSelect;

function serializeBook(book: Book) {
  return {
    id: book.id,
    asin: book.asin,
    marketplace: book.marketplace,
    title: book.title,
    category: book.category,
    bsr: book.bsr,
    price: book.price === null ? null : Number(book.price),
    reviews: book.reviews,
    estimatedDailySales: book.estimatedDailySales,
    estimatedMonthlySales: book.estimatedDailySales === null ? null : book.estimatedDailySales * 30,
    url: `https://${AMAZON_HOSTS[book.marketplace]}/dp/${book.asin}`,
    lastCheckedAt: book.lastCheckedAt,
    createdAt: book.createdAt,
  };
}

/**
 * An org's saved books, most recently checked first, each with its BSR history
 */
export async function listBooks(orgId: string) {
  const books = await db.select().from(trackedBooks).where(eq(trackedBooks.orgId, orgId)).orderBy(desc(trackedBooks.lastCheckedAt));
  if (books.length === 0) return [];

  const snapshots = await db
    .select({ bookId: bookSnapshots.bookId, bsr: bookSnapshots.bsr, capturedAt: bookSnapshots.capturedAt })
    .from(bookSnapshots)
    .where(inArray(bookSnapshots.bookId, books.map((b) => b.id)))
    .orderBy(desc(bookSnapshots.capturedAt));

  return books.map((book) => ({
    ...serializeBook(book),
    history: snapshots
      .filter((s) => s.bookId === book.id)
      .slice(0, HISTORY_POINTS)
      .reverse()
      .map(({ bsr, capturedAt }) => ({ bsr, capturedAt })),
  }));
}

export async function deleteBook(orgId: string, bookId: string): Promise<boolean> {
  const deleted = await db
    .delete(trackedBooks)
    .where(and(eq(trackedBooks.id, bookId), eq(trackedBooks.orgId, orgId)))
    .returning({ id: trackedBooks.id });
  return deleted.length > 0;
}
