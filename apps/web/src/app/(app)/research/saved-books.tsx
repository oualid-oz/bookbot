'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkIcon, ColumnsIcon, ExternalLinkIcon, PencilIcon, Trash2Icon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api-client';
import { BookCompareDialog } from './book-compare';
import { BookNotesDialog } from './book-notes-dialog';

export interface SavedBook {
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
  notes: string;
  tags: string[];
  url: string;
  lastCheckedAt: string;
  history: { bsr: number | null; capturedAt: string }[];
}

const number = (value: number | null) => (value === null ? '—' : value.toLocaleString());

/** More than this doesn't fit side by side */
const MAX_COMPARE = 4;

export function SavedBooks() {
  const [books, setBooks] = useState<SavedBook[] | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<SavedBook | null>(null);
  const [comparing, setComparing] = useState(false);

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
      setSelected((ids) => ids.filter((id) => id !== book.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove the book');
    }
  };

  const toggle = (id: string, on: boolean) => setSelected((ids) => (on ? [...ids, id] : ids.filter((x) => x !== id)));
  const allTags = [...new Set(books?.flatMap((b) => b.tags) ?? [])].sort();
  // A tag can disappear when the last book using it is edited
  const activeTag = tagFilter && allTags.includes(tagFilter) ? tagFilter : null;
  const shown = books?.filter((b) => !activeTag || b.tags.includes(activeTag)) ?? [];
  const selectedBooks = selected.map((id) => books?.find((b) => b.id === id)).filter((b): b is SavedBook => !!b);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Saved books</CardTitle>
        <CardDescription>
          Books saved from Amazon with the Chrome extension. Save a book again to add to its history. Tick {MAX_COMPARE} or fewer to compare them.
        </CardDescription>
        {!!books?.length && (
          <CardAction>
            <Button variant="outline" size="sm" disabled={selectedBooks.length < 2} onClick={() => setComparing(true)}>
              <ColumnsIcon />
              Compare{selectedBooks.length ? ` (${selectedBooks.length})` : ''}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" aria-label="Filter by tag">
            <Button variant={activeTag ? 'ghost' : 'secondary'} size="sm" onClick={() => setTagFilter(null)}>All</Button>
            {allTags.map((tag) => (
              <Button key={tag} variant={activeTag === tag ? 'secondary' : 'ghost'} size="sm" onClick={() => setTagFilter(tag)}>{tag}</Button>
            ))}
          </div>
        )}
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
                <TableHead className="w-8" />
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
              {shown.map((book) => (
                <TableRow key={book.id}>
                  <TableCell>
                    <Checkbox aria-label={`Compare ${book.title}`} checked={selected.includes(book.id)}
                      disabled={!selected.includes(book.id) && selected.length >= MAX_COMPARE}
                      onCheckedChange={(on) => toggle(book.id, on === true)} />
                  </TableCell>
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
                    {book.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {book.tags.map((tag) => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                      </div>
                    )}
                    {book.notes && <p className="mt-1 line-clamp-2 text-xs whitespace-normal text-muted-foreground">{book.notes}</p>}
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
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon-sm" aria-label={`Notes and tags for ${book.title}`} onClick={() => setEditing(book)}>
                      <PencilIcon />
                    </Button>
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

      {editing && (
        <BookNotesDialog
          book={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setBooks((list) => list?.map((b) => (b.id === saved.id ? saved : b)) ?? null);
            setEditing(null);
          }}
        />
      )}
      {comparing && selectedBooks.length >= 2 && <BookCompareDialog books={selectedBooks} onClose={() => setComparing(false)} />}
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
