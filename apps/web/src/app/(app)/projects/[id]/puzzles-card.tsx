'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangleIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiFetch } from '@/lib/api-client';

interface Puzzle {
  id: string;
  width: number;
  height: number;
  words: string[];
  unplaced: string[];
}

const GRID_SIZES = [10, 12, 15, 18, 20];

export function PuzzlesCard({ projectId, highlighted }: { projectId: string; highlighted: boolean }) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [words, setWords] = useState('');
  const [size, setSize] = useState('12');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(
    () =>
      apiFetch<{ puzzles: Puzzle[] }>(`/api/projects/${projectId}/puzzles`)
        .then((data) => setPuzzles(data.puzzles))
        .catch(() => {}),
    [projectId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const list = words.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
      const { puzzle } = await apiFetch<{ puzzle: { unplaced: string[] } }>(`/api/projects/${projectId}/puzzles`, {
        method: 'POST',
        body: { words: list, width: Number(size), height: Number(size) },
      });
      setWords('');
      await load();
      if (puzzle.unplaced.length) {
        toast.warning(`${puzzle.unplaced.length} word(s) didn't fit: ${puzzle.unplaced.join(', ')}`);
      } else {
        toast.success('Puzzle added');
      }
    } catch (err) {
      setError(err instanceof ApiError ? (err.fields.words?.[0] ?? err.message) : 'Could not add puzzle');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (puzzleId: string) => {
    try {
      await apiFetch(`/api/projects/${projectId}/puzzles/${puzzleId}`, { method: 'DELETE' });
      setPuzzles((p) => p.filter((x) => x.id !== puzzleId));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete puzzle');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Word search puzzles</CardTitle>
        <CardDescription>
          {highlighted ? 'Each puzzle gets its own page, with solutions at the back.' : 'Optional: add puzzles to any book.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleAdd}>
          <FieldGroup>
            <Field data-invalid={!!error}>
              <FieldLabel htmlFor="words">Words</FieldLabel>
              <Textarea id="words" rows={3} value={words} aria-invalid={!!error}
                onChange={(e) => setWords(e.target.value)} placeholder="cat, dog, bird, fish" />
              {error ? <FieldError>{error}</FieldError> : <FieldDescription>Separate with commas or new lines. Up to 40 words.</FieldDescription>}
            </Field>
            <div className="flex items-end gap-2">
              <Field className="w-32">
                <FieldLabel htmlFor="grid">Grid</FieldLabel>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger id="grid" className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRID_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} × {n}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Button type="submit" disabled={adding || !words.trim()}>
                {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                Add puzzle
              </Button>
            </div>
          </FieldGroup>
        </form>

        {puzzles.map((puzzle, i) => (
          <div key={puzzle.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-medium">
                Puzzle {i + 1}
                <Badge variant="outline">{puzzle.width} × {puzzle.height}</Badge>
                <Badge variant="secondary">{puzzle.words.length} words</Badge>
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete puzzle ${i + 1}`} onClick={() => handleDelete(puzzle.id)}>
                <Trash2Icon />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">{puzzle.words.join(', ')}</p>
            {puzzle.unplaced.length > 0 && (
              <Alert>
                <AlertTriangleIcon />
                <AlertTitle>{puzzle.unplaced.length} word(s) didn&apos;t fit</AlertTitle>
                <AlertDescription>
                  {puzzle.unplaced.join(', ')} left out. Use a bigger grid or fewer words.
                </AlertDescription>
              </Alert>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
