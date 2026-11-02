/**
 * Fonts for book interiors. The PDF's built-in fonts need no file; the others
 * are OFL-licensed (licenses in files/licenses) and are embedded in exports,
 * as KDP requires.
 */
export interface FontInfo {
  name: string;
  category: 'sans' | 'serif' | 'mono' | 'handwritten' | 'display';
  /** Built-in PDF font: no file to embed */
  standard?: 'Helvetica' | 'TimesRoman' | 'Courier';
  /** TTF files in files/; fonts without a bold reuse the regular */
  regular?: string;
  bold?: string;
  /** Too decorative for long text: offered for titles only */
  headingOnly?: boolean;
}

export const FONTS = {
  helvetica: { name: 'Helvetica', category: 'sans', standard: 'Helvetica' },
  lato: { name: 'Lato', category: 'sans', regular: 'Lato-Regular.ttf', bold: 'Lato-Bold.ttf' },
  poppins: { name: 'Poppins', category: 'sans', regular: 'Poppins-Regular.ttf', bold: 'Poppins-Bold.ttf' },
  times: { name: 'Times', category: 'serif', standard: 'TimesRoman' },
  ptserif: { name: 'PT Serif', category: 'serif', regular: 'PT_Serif-Web-Regular.ttf', bold: 'PT_Serif-Web-Bold.ttf' },
  courier: { name: 'Courier', category: 'mono', standard: 'Courier' },
  comicneue: { name: 'Comic Neue', category: 'handwritten', regular: 'ComicNeue-Regular.ttf', bold: 'ComicNeue-Bold.ttf' },
  patrickhand: { name: 'Patrick Hand', category: 'handwritten', regular: 'PatrickHand-Regular.ttf' },
  amaticsc: { name: 'Amatic SC', category: 'display', regular: 'AmaticSC-Regular.ttf', bold: 'AmaticSC-Bold.ttf', headingOnly: true },
  bebasneue: { name: 'Bebas Neue', category: 'display', regular: 'BebasNeue-Regular.ttf', headingOnly: true },
  lobster: { name: 'Lobster', category: 'display', regular: 'Lobster-Regular.ttf', headingOnly: true },
  pacifico: { name: 'Pacifico', category: 'display', regular: 'Pacifico-Regular.ttf', headingOnly: true },
} as const satisfies Record<string, FontInfo>;

export type FontId = keyof typeof FONTS;

export const FONT_IDS = Object.keys(FONTS) as [FontId, ...FontId[]];

export const BODY_FONT_IDS = FONT_IDS.filter((id) => !(FONTS[id] as FontInfo).headingOnly);

/** Every font file, for serving them to the browser */
export const FONT_FILES: string[] = Object.values(FONTS as Record<string, FontInfo>).flatMap((f) =>
  [f.regular, f.bold].filter((file): file is string => !!file)
);
