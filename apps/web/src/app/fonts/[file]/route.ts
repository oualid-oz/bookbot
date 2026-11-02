import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { FONT_FILES } from '@bookbot/fonts';

/**
 * The interior fonts, for previews in the browser. Read from the fonts
 * package (apps/web is the working directory in dev and in the standalone build).
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/fonts/[file]'>) {
  const { file } = await ctx.params;
  if (!FONT_FILES.includes(file)) return new Response('Not found', { status: 404 });

  const bytes = await readFile(path.join(process.cwd(), '..', '..', 'packages', 'fonts', 'files', file));
  return new Response(bytes, {
    headers: {
      'Content-Type': 'font/ttf',
      // The files never change under the same name
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
