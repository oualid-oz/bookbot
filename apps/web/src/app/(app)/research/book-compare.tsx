'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { cn } from 'cn';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { SavedBook } from './saved-books';

const number = (value: number | null) => (value === null ? '—' : value.toLocaleString());

/** The index of the best value, or -1 when fewer than two books have one or they tie */
function bestIndex(values: (number | null)[], better: 'lower' | 'higher') {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2 || new Set(known).size === 1) return -1;
  const best = better === 'lower' ? Math.min(...known) : Math.max(...known);
  return values.indexOf(best);
}

/** Rank movement over the saved history, e.g. "#900 → #500" */
function rankTrend(book: SavedBook) {
  const ranks = book.history.map((h) => h.bsr).filter((r): r is number => r !== null);
  if (ranks.length < 2) return 'Not enough history';
  return `#${ranks[0].toLocaleString()} → #${ranks.at(-1)!.toLocaleString()}`;
}

/** Saved books side by side; the best rank and sales are highlighted */
export function BookCompareDialog({ books, onClose }: { books: SavedBook[]; onClose: () => void }) {
  const differs = (values: unknown[]) => new Set(values).size > 1;
  const mixed = differs(books.map((b) => b.marketplace)) || differs(books.map((b) => b.category));

  const rows: { label: string; cell: (book: SavedBook) => React.ReactNode; best?: number }[] = [
    { label: 'Category', cell: (b) => b.category ?? '—' },
    { label: 'Marketplace', cell: (b) => b.marketplace },
    { label: 'Best Sellers Rank', cell: (b) => (b.bsr === null ? '—' : `#${number(b.bsr)}`), best: mixed ? -1 : bestIndex(books.map((b) => b.bsr), 'lower') },
    {
      label: 'Estimated sales / month',
      cell: (b) => (b.estimatedMonthlySales === null ? '—' : `~${number(b.estimatedMonthlySales)}`),
      best: bestIndex(books.map((b) => b.estimatedMonthlySales), 'higher'),
    },
    { label: 'Rank over time', cell: rankTrend },
    { label: 'Price', cell: (b) => (b.price === null ? '—' : b.price.toFixed(2)) },
    { label: 'Reviews', cell: (b) => number(b.reviews) },
    { label: 'Tags', cell: (b) => b.tags.join(', ') || '—' },
    { label: 'Notes', cell: (b) => <span className="whitespace-pre-wrap">{b.notes || '—'}</span> },
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Compare books</DialogTitle>
          <DialogDescription>Numbers from when each book was last saved. Sales are estimates.</DialogDescription>
        </DialogHeader>
        {mixed && (
          <Alert>
            <TriangleAlertIcon />
            <AlertDescription>
              These books are in different categories or marketplaces, so their ranks aren&apos;t directly comparable.
            </AlertDescription>
          </Alert>
        )}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44" />
              {books.map((book) => (
                <TableHead key={book.id} className="align-top whitespace-normal">
                  <a href={book.url} target="_blank" rel="noopener noreferrer" className="line-clamp-3 py-1 font-medium hover:underline">{book.title}</a>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell className="align-top text-muted-foreground">{row.label}</TableCell>
                {books.map((book, i) => (
                  <TableCell key={book.id} className={cn('align-top whitespace-normal tabular-nums', row.best === i && 'font-semibold text-emerald-700 dark:text-emerald-400')}>
                    {row.cell(book)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
