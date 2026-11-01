import { NextResponse } from 'next/server';
import { WORD_THEMES } from '@bookbot/puzzles';

/** Built-in word search themes and their topics */
export function GET() {
  const themes = Object.entries(WORD_THEMES).map(([id, theme]) => ({
    id,
    name: theme.name,
    topics: theme.topics.map((t) => t.title),
  }));
  return NextResponse.json({ themes });
}
