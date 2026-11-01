'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangleIcon, Loader2Icon, PlusIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { SUDOKU_LEVELS, type PuzzleType } from '@bookbot/shared';
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
  type: PuzzleType;
  width?: number;
  height?: number;
  words?: string[];
  unplaced?: string[];
  difficulty?: string;
  clues?: number;
}

const TYPE_NAMES: Record<PuzzleType, string> = { word_search: 'Word search', sudoku: 'Sudoku', maze: 'Maze' };

const GRID_SIZES = [10, 12, 15, 18, 20];

/** Portrait sizes, so mazes fill the page */
const MAZE_SIZES = [
  { label: 'Easy · 10 × 12', width: 10, height: 12 },
  { label: 'Medium · 15 × 20', width: 15, height: 20 },
  { label: 'Hard · 22 × 30', width: 22, height: 30 },
  { label: 'Expert · 30 × 40', width: 30, height: 40 },
];

const COUNTS = [1, 5, 10, 25, 50];

const capitalize = (s: string) => s[0].toUpperCase() + s.slice(1);

export function PuzzlesCard({ projectId, highlighted }: { projectId: string; highlighted: boolean }) {
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [type, setType] = useState<PuzzleType>('word_search');
  const [words, setWords] = useState('');
  const [size, setSize] = useState('12');
  const [difficulty, setDifficulty] = useState<string>('medium');
  const [mazeSize, setMazeSize] = useState('1');
  const [count, setCount] = useState('1');
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

  const requestBody = () => {
    if (type === 'sudoku') return { type, difficulty, count: Number(count) };
    if (type === 'maze') {
      const { width, height } = MAZE_SIZES[Number(mazeSize)];
      return { type, width, height, count: Number(count) };
    }
    const list = words.split(/[\n,]+/).map((w) => w.trim()).filter(Boolean);
    return { type, words: list, width: Number(size), height: Number(size) };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setAdding(true);
    try {
      const { puzzles: added } = await apiFetch<{ puzzles: Puzzle[] }>(`/api/projects/${projectId}/puzzles`, {
        method: 'POST',
        body: requestBody(),
      });
      await load();
      if (type === 'word_search') setWords('');
      const unplaced = added[0]?.unplaced ?? [];
      if (unplaced.length) {
        toast.warning(`${unplaced.length} word(s) didn't fit: ${unplaced.join(', ')}`);
      } else {
        toast.success(added.length === 1 ? 'Puzzle added' : `${added.length} puzzles added`);
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

  const countField = (
    <Field className="w-28">
      <FieldLabel htmlFor="puzzle-count">How many</FieldLabel>
      <Select value={count} onValueChange={setCount}>
        <SelectTrigger id="puzzle-count" className="w-full"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COUNTS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Puzzles</CardTitle>
        <CardDescription>
          {highlighted ? 'Each puzzle gets its own page, with solutions at the back.' : 'Optional: add puzzles to any book.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleAdd}>
          <FieldGroup>
            <Field className="w-44">
              <FieldLabel htmlFor="puzzle-type">Type</FieldLabel>
              <Select value={type} onValueChange={(value) => { setType(value as PuzzleType); setError(''); }}>
                <SelectTrigger id="puzzle-type" className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_NAMES).map(([value, name]) => <SelectItem key={value} value={value}>{name}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>

            {type === 'word_search' && (
              <Field data-invalid={!!error}>
                <FieldLabel htmlFor="words">Words</FieldLabel>
                <Textarea id="words" rows={3} value={words} aria-invalid={!!error}
                  onChange={(e) => setWords(e.target.value)} placeholder="cat, dog, bird, fish" />
                {error ? <FieldError>{error}</FieldError> : <FieldDescription>Separate with commas or new lines. Up to 40 words.</FieldDescription>}
              </Field>
            )}

            <div className="flex flex-wrap items-end gap-2">
              {type === 'word_search' && (
                <Field className="w-32">
                  <FieldLabel htmlFor="grid">Grid</FieldLabel>
                  <Select value={size} onValueChange={setSize}>
                    <SelectTrigger id="grid" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GRID_SIZES.map((n) => <SelectItem key={n} value={String(n)}>{n} × {n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {type === 'sudoku' && (
                <>
                  <Field className="w-36">
                    <FieldLabel htmlFor="difficulty">Difficulty</FieldLabel>
                    <Select value={difficulty} onValueChange={setDifficulty}>
                      <SelectTrigger id="difficulty" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SUDOKU_LEVELS.map((level) => <SelectItem key={level} value={level}>{capitalize(level)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  {countField}
                </>
              )}
              {type === 'maze' && (
                <>
                  <Field className="w-48">
                    <FieldLabel htmlFor="maze-size">Size</FieldLabel>
                    <Select value={mazeSize} onValueChange={setMazeSize}>
                      <SelectTrigger id="maze-size" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MAZE_SIZES.map((s, i) => <SelectItem key={s.label} value={String(i)}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  {countField}
                </>
              )}
              <Button type="submit" disabled={adding || (type === 'word_search' && !words.trim())}>
                {adding ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
                {type === 'word_search' || count === '1' ? 'Add puzzle' : `Add ${count} puzzles`}
              </Button>
            </div>
            {type !== 'word_search' && error && <FieldError>{error}</FieldError>}
          </FieldGroup>
        </form>

        {puzzles.map((puzzle, i) => (
          <div key={puzzle.id} className="flex flex-col gap-2 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 font-medium">
                Puzzle {i + 1}
                <Badge>{TYPE_NAMES[puzzle.type] ?? puzzle.type}</Badge>
                {puzzle.width && <Badge variant="outline">{puzzle.width} × {puzzle.height}</Badge>}
                {puzzle.words && <Badge variant="secondary">{puzzle.words.length} words</Badge>}
                {puzzle.difficulty && <Badge variant="outline">{capitalize(puzzle.difficulty)}</Badge>}
                {puzzle.clues && <Badge variant="secondary">{puzzle.clues} clues</Badge>}
              </div>
              <Button variant="ghost" size="icon-sm" aria-label={`Delete puzzle ${i + 1}`} onClick={() => handleDelete(puzzle.id)}>
                <Trash2Icon />
              </Button>
            </div>
            {puzzle.words && <p className="text-sm text-muted-foreground">{puzzle.words.join(', ')}</p>}
            {puzzle.unplaced && puzzle.unplaced.length > 0 && (
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
