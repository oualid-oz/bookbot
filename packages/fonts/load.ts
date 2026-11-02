import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { FONT_FILES } from './index';

/** Folder with the font files, next to this module */
export const FONT_DIR = path.join(__dirname, 'files');

/** Bytes of a font file; only names from FONTS are allowed */
export async function readFontFile(file: string): Promise<Uint8Array> {
  if (!FONT_FILES.includes(file)) throw new Error(`Unknown font file ${file}`);
  return new Uint8Array(await readFile(path.join(FONT_DIR, file)));
}
