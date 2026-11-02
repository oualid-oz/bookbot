import { describe, it, expect } from 'vitest';
import { BODY_FONT_IDS, FONTS, FONT_FILES, type FontInfo } from './index';
import { readFontFile } from './load';

describe('FONTS', () => {
  it('has a readable TrueType file for every font that needs one', async () => {
    for (const file of FONT_FILES) {
      const bytes = await readFontFile(file);
      // TrueType files start with 0x00010000
      expect([...bytes.slice(0, 4)], file).toEqual([0, 1, 0, 0]);
    }
  });

  it('gives every font either a built-in PDF font or a file', () => {
    for (const font of Object.values(FONTS) as FontInfo[]) {
      expect(!!font.standard !== !!font.regular, font.name).toBe(true);
    }
  });

  it('keeps decorative fonts out of body text', () => {
    expect(BODY_FONT_IDS).not.toContain('lobster');
    expect(BODY_FONT_IDS).toContain('lato');
  });

  it('refuses files outside the list', async () => {
    await expect(readFontFile('../index.ts')).rejects.toThrow('Unknown font file');
  });
});
