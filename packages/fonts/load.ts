import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FONT_FILES } from './index';

/**
 * Folder with the font files: next to this module when run directly (worker),
 * or found from the app's folder when bundled by Next.js (web on Vercel), where
 * __dirname doesn't point here
 */
export const FONT_DIR = [
  path.join(__dirname, 'files'),
  path.join(process.cwd(), '..', '..', 'packages', 'fonts', 'files'),
  path.join(process.cwd(), 'packages', 'fonts', 'files'),
].find((dir) => existsSync(path.join(dir, FONT_FILES[0]))) ?? path.join(__dirname, 'files');

/** Bytes of a font file; only names from FONTS are allowed */
export async function readFontFile(file: string): Promise<Uint8Array> {
  if (!FONT_FILES.includes(file)) throw new Error(`Unknown font file ${file}`);
  // The font files are listed in next.config.ts (outputFileTracingIncludes), so
  // the bundler shouldn't try to trace this dynamic path itself
  return new Uint8Array(await readFile(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ FONT_DIR, file)));
}
