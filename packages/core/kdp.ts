/**
 * KDP Calculators
 * 
 * Trim sizes, bleed, and spine calculations for KDP print-on-demand
 */

export interface TrimSize {
  width: number; // inches
  height: number; // inches
  name: string;
}

export interface PaperType {
  name: string;
  thickness: number; // inches per page
}

export const TRIM_SIZES: Record<string, TrimSize> = {
  '5x8': { width: 5, height: 8, name: '5" x 8"' },
  '5.25x8': { width: 5.25, height: 8, name: '5.25" x 8"' },
  '5.5x8.5': { width: 5.5, height: 8.5, name: '5.5" x 8.5"' },
  '6x9': { width: 6, height: 9, name: '6" x 9"' },
  '6.14x9.21': { width: 6.14, height: 9.21, name: '6.14" x 9.21"' },
  '6.69x9.61': { width: 6.69, height: 9.61, name: '6.69" x 9.61"' },
  '7x10': { width: 7, height: 10, name: '7" x 10"' },
  '7.44x9.69': { width: 7.44, height: 9.69, name: '7.44" x 9.69"' },
  '7.5x9.25': { width: 7.5, height: 9.25, name: '7.5" x 9.25"' },
  '8x10': { width: 8, height: 10, name: '8" x 10"' },
  '8.25x6': { width: 8.25, height: 6, name: '8.25" x 6"' },
  '8.25x8.25': { width: 8.25, height: 8.25, name: '8.25" x 8.25"' },
  '8.5x8.5': { width: 8.5, height: 8.5, name: '8.5" x 8.5"' },
  '8.5x11': { width: 8.5, height: 11, name: '8.5" x 11"' },
};

export const PAPER_TYPES: Record<string, PaperType> = {
  white: { name: 'White', thickness: 0.0022 },
  cream: { name: 'Cream', thickness: 0.0025 },
  color: { name: 'Color', thickness: 0.0034 },
};

export const BLEED_SIZE = 0.125; // 1/8 inch bleed on each side

/**
 * Calculate spine width based on page count and paper type
 */
export function calculateSpineWidth(
  pageCount: number,
  paperType: string = 'white'
): number {
  const paper = PAPER_TYPES[paperType] || PAPER_TYPES.white;
  return pageCount * paper.thickness;
}

/**
 * Calculate full cover dimensions (spine + bleed)
 */
export function calculateCoverDimensions(
  trimSize: string,
  pageCount: number,
  paperType: string = 'white'
): {
  width: number;
  height: number;
  spineWidth: number;
  totalWidth: number;
  bleed: number;
} {
  const trim = TRIM_SIZES[trimSize] || TRIM_SIZES['6x9'];
  const spineWidth = calculateSpineWidth(pageCount, paperType);
  const bleed = BLEED_SIZE;

  // Full cover width = back bleed + back cover + spine + front cover + front bleed
  const totalWidth = bleed + trim.width + spineWidth + trim.width + bleed;
  const height = trim.height + bleed * 2;

  return {
    width: trim.width,
    height: trim.height,
    spineWidth,
    totalWidth,
    bleed,
  };
}

/**
 * Calculate interior page dimensions with bleed
 */
export function calculateInteriorDimensions(
  trimSize: string
): {
  width: number;
  height: number;
  bleed: number;
  totalWidth: number;
  totalHeight: number;
} {
  const trim = TRIM_SIZES[trimSize] || TRIM_SIZES['6x9'];
  const bleed = BLEED_SIZE;

  return {
    width: trim.width,
    height: trim.height,
    bleed,
    totalWidth: trim.width + bleed * 2,
    totalHeight: trim.height + bleed * 2,
  };
}

/**
 * Get all available trim sizes
 */
export function getAvailableTrimSizes(): TrimSize[] {
  return Object.values(TRIM_SIZES);
}

/**
 * Get all available paper types
 */
export function getAvailablePaperTypes(): PaperType[] {
  return Object.values(PAPER_TYPES);
}
