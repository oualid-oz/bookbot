'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkIcon, ExternalLinkIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';

interface SavedBook {
  id: string;
  asin: string;
  marketplace: string;
  title: string;
  category: string | null;
  bsr: number | null;
  price: number | null;
  reviews: number | null;
  estimatedDailySales: number | null;
  estimatedMonthlySales: number | null;
  url: string;
  lastCheckedAt: string;
  history: { bsr: number | null; capturedAt: string }[];
}

const number = (value: number | null) => (value === null ? '—' : value.toLocaleString());

export function SavedBooks() {
  const [books, setBooks] = useState<SavedBook[] | null>(null);

  useEffect(() => {
    apiFetch<{ books: SavedBook[] }>('/api/books')
      .then((data) => setBooks(data.books))
      .catch((err) => {
        toast.error(err.message);
        setBooks([]);
      });
  }, []);

  const remove = async (book: SavedBook) => {
    try {
      await apiFetch(`/api/books/${book.id}`, { method: 'DELETE' });
      setBooks((list) => list?.filter((b) => b.id !== book.id) ?? null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the book');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved books</CardTitle>
        <CardDescription>Books saved from Amazon with the Chrome extension. Save a book again to add to its history.</CardDescription>
      </CardHeader>
      <CardContent>
        {books === null ? (
          <Skeleton className="h-32" />
        ) : books.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
            <BookmarkIcon className="size-5" />
            <p>
              Open a book on Amazon and click <span className="font-medium text-foreground">Save to Bookbot</span> in the
              extension panel.
            </p>
            <Button variant="link" size="sm" asChild>
              <Link href="/settings/extension">Set up the extension</Link>
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Book</TableHead>
                <TableHead className="text-right">BSR</TableHead>
                <TableHead>Trend</TableHead>
                <TableHead className="text-right">Sales / month</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Reviews</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {books.map((book) => (
                <TableRow key={book.id}>
                  <TableCell className="max-w-72">
                    <a href={book.url} target="_blank" rel="noopener noreferrer" className="group flex items-start gap-1 font-medium">
                      <span className="line-clamp-2 whitespace-normal group-hover:underline">{book.title}</span>
                      <ExternalLinkIcon className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    </a>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Badge variant="outline">{book.marketplace}</Badge>
                      {book.category && <span className="truncate">{book.category}</span>}
                      <span>· {new Date(book.lastCheckedAt).toLocaleDateString()}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{book.bsr === null ? '—' : `#${number(book.bsr)}`}</TableCell>
                  <TableCell>
                    <BsrTrend history={book.history} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums" title={book.estimatedDailySales === null ? 'No sales model for this category yet' : `~${book.estimatedDailySales}/day`}>
                    {book.estimatedMonthlySales === null ? '—' : `~${number(book.estimatedMonthlySales)}`}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{book.price === null ? '—' : book.price.toFixed(2)}</TableCell>
                  <TableCell className="text-right tabular-nums">{number(book.reviews)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon-sm" aria-label={`Remove ${book.title}`} onClick={() => remove(book)}>
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * BSR over the saved snapshots. Lower BSR is better, so the line is flipped:
 * up means the book is ranking better.
 */
function BsrTrend({ history }: { history: SavedBook['history'] }) {
  const points = history.filter((h): h is { bsr: number; capturedAt: string } => h.bsr !== null);
  if (points.length < 2) {
    return <span className="text-xs text-muted-foreground">Save again later</span>;
  }

  const width = 80;
  const height = 24;
  const ranks = points.map((p) => p.bsr);
  const min = Math.min(...ranks);
  const max = Math.max(...ranks);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = max === min ? height / 2 : ((p.bsr - min) / (max - min)) * (height - 4) + 2;
      return `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const improved = ranks.at(-1)! < ranks[0];
  const Icon = improved ? TrendingUpIcon : TrendingDownIcon;
  const label = `BSR ${improved ? 'improved' : 'worsened'} from #${ranks[0].toLocaleString()} to #${ranks.at(-1)!.toLocaleString()} over ${points.length} checks`;

  return (
    <div className="flex items-center gap-1.5" title={label} aria-label={label}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible text-muted-foreground" aria-hidden>
        <path d={path} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
      </svg>
      <Icon className={improved ? 'size-4 text-emerald-600 dark:text-emerald-400' : 'size-4 text-destructive'} />
    </div>
  );
}
