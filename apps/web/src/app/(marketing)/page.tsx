import Link from 'next/link';
import { BookOpenIcon, PaletteIcon, PuzzleIcon, SearchIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const FEATURES = [
  { icon: SearchIcon, title: 'Niche research', description: 'Keyword volume, competition, and BSR-based sales estimates.' },
  { icon: PaletteIcon, title: 'Cover studio', description: 'Full wrap-around covers sized to KDP trim, bleed, and spine.' },
  { icon: PuzzleIcon, title: 'Puzzle books', description: 'Generate reproducible word search puzzles from a seed.' },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-12 px-6 py-24">
      <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <BookOpenIcon className="size-6" />
        </div>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Bookbot</h1>
        <p className="text-lg text-muted-foreground">
          Research KDP niches, design covers, and generate puzzle books.
        </p>
        <div className="flex gap-3">
          <Button size="lg" asChild>
            <Link href="/signup">Get started</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button size="lg" variant="ghost" asChild>
            <Link href="/pricing">Pricing</Link>
          </Button>
        </div>
      </div>

      <div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, description }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-2 size-5 text-muted-foreground" />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </main>
  );
}
