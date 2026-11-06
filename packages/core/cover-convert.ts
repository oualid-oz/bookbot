/**
 * Fit a finished full-wrap cover (back + spine + front) to a new trim size,
 * page count or paper: each panel is cut from the source and resized to its
 * place in the new layout. Pure math, so it can be tested without a canvas.
 */
import { BLEED_SIZE, PAPER_TYPES, TRIM_SIZES, calculateCoverDimensions, canHaveSpineText } from './kdp';
import { MIN_PRINT_DPI } from './cover';

export interface CoverSpec {
  trimSize: string;
  pageCount: number;
  paper: string;
}

/** A rectangle in source pixels or, for destinations, inches */
export interface ConvertRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ConvertPanel {
  name: 'back' | 'spine' | 'front';
  source: ConvertRect;
  dest: ConvertRect;
}

export interface CoverConversion {
  /** Finished size in inches, bleed included */
  width: number;
  height: number;
  panels: ConvertPanel[];
  /** Print resolution of the front and back artwork */
  effectiveDpi: number;
  /** Trim and spine lines in inches, for preview guides (not printed) */
  guides: { trimLeft: number; spineLeft: number; spineRight: number; trimRight: number; trimTop: number; trimBottom: number };
  warnings: string[];
}

/** How far an image's shape may be from the expected wrap before it's flagged */
const SHAPE_TOLERANCE = 0.015;
/** Cropping or spine stretching below this share isn't noticeable */
const CROP_NOTICE = 0.03;
const SPINE_STRETCH_NOTICE = 0.2;

/** The largest centered part of `rect` with the same shape as width × height */
function centeredCrop(rect: ConvertRect, width: number, height: number): ConvertRect {
  const target = width / height;
  if (rect.width / rect.height > target) {
    const cropped = rect.height * target;
    return { ...rect, x: rect.x + (rect.width - cropped) / 2, width: cropped };
  }
  const cropped = rect.width / target;
  return { ...rect, y: rect.y + (rect.height - cropped) / 2, height: cropped };
}

/**
 * The page count whose spine would make a wrap of this image's shape, for
 * telling which book an image was made for. Null if the shape can't be a wrap.
 */
export function guessPageCount(imageWidth: number, imageHeight: number, trimSize: string, paper: string): number | null {
  const trim = TRIM_SIZES[trimSize];
  const thickness = PAPER_TYPES[paper]?.thickness;
  if (!trim || !thickness || !imageWidth || !imageHeight) return null;
  const totalHeight = trim.height + 2 * BLEED_SIZE;
  const totalWidth = (imageWidth / imageHeight) * totalHeight;
  const spine = totalWidth - 2 * trim.width - 2 * BLEED_SIZE;
  const pages = Math.round(spine / thickness);
  return pages > 0 ? pages : null;
}

export function planCoverConversion(imageWidth: number, imageHeight: number, source: CoverSpec, target: CoverSpec): CoverConversion {
  const from = calculateCoverDimensions(source.trimSize, source.pageCount, source.paper);
  const to = calculateCoverDimensions(target.trimSize, target.pageCount, target.paper);
  const warnings: string[] = [];

  // Source pixels per inch across the wrap; every panel uses the full height
  const sx = imageWidth / from.totalWidth;

  const fromBackWidth = from.bleed + from.width;
  const toBackWidth = to.bleed + to.width;

  const backSource: ConvertRect = { x: 0, y: 0, width: fromBackWidth * sx, height: imageHeight };
  const spineSource: ConvertRect = { x: fromBackWidth * sx, y: 0, width: from.spineWidth * sx, height: imageHeight };
  const frontSource: ConvertRect = { x: (fromBackWidth + from.spineWidth) * sx, y: 0, width: fromBackWidth * sx, height: imageHeight };

  const backDest: ConvertRect = { x: 0, y: 0, width: toBackWidth, height: to.totalHeight };
  const spineDest: ConvertRect = { x: toBackWidth, y: 0, width: to.spineWidth, height: to.totalHeight };
  const frontDest: ConvertRect = { x: toBackWidth + to.spineWidth, y: 0, width: toBackWidth, height: to.totalHeight };

  const panels: ConvertPanel[] = [
    { name: 'back', source: centeredCrop(backSource, backDest.width, backDest.height), dest: backDest },
    // The spine is stretched, not cropped: its text must stay whole
    { name: 'spine', source: spineSource, dest: spineDest },
    { name: 'front', source: centeredCrop(frontSource, frontDest.width, frontDest.height), dest: frontDest },
  ];

  // Judged on the artwork: stretching a narrow spine has its own warning
  const effectiveDpi = Math.round(
    Math.min(...[panels[0], panels[2]].map((p) => Math.min(p.source.width / p.dest.width, p.source.height / p.dest.height)))
  );

  // ---- What could go wrong ----
  const expectedShape = from.totalWidth / from.totalHeight;
  if (Math.abs(imageWidth / imageHeight / expectedShape - 1) > SHAPE_TOLERANCE) {
    const guess = guessPageCount(imageWidth, imageHeight, source.trimSize, source.paper);
    warnings.push(
      guess
        ? `This image doesn't match the size you chose for it. Its shape fits about ${guess} pages at this trim and paper: check the current size, or the panels will be cut in the wrong places.`
        : "This image isn't shaped like a full cover at this size. Use the whole wrap (back, spine and front), or the panels will be cut in the wrong places."
    );
  }
  if (effectiveDpi < MIN_PRINT_DPI) {
    warnings.push(`The result would print at about ${effectiveDpi} DPI; KDP recommends at least ${MIN_PRINT_DPI}. It may look blurry.`);
  }
  const cropped = Math.max(1 - panels[2].source.width / frontSource.width, 1 - panels[2].source.height / frontSource.height);
  if (cropped > CROP_NOTICE) {
    const side = panels[2].source.width < frontSource.width ? 'the left and right' : 'the top and bottom';
    warnings.push(`The new size has a different shape, so about ${Math.round(cropped * 100)}% is cut from ${side} of the front and back. Check that no text is lost.`);
  }
  const stretch = to.spineWidth / from.spineWidth;
  if (canHaveSpineText(target.pageCount) && Math.abs(stretch - 1) > SPINE_STRETCH_NOTICE) {
    warnings.push(`The spine becomes ${stretch > 1 ? 'wider' : 'narrower'} (${from.spineWidth.toFixed(2)}" → ${to.spineWidth.toFixed(2)}"), so any text on it is stretched. Check how it looks.`);
  }
  if (!canHaveSpineText(target.pageCount) && canHaveSpineText(source.pageCount)) {
    warnings.push(`KDP doesn't allow spine text at ${target.pageCount} pages. If this cover has text on its spine, remove it first.`);
  }

  const spineLeft = toBackWidth;
  const spineRight = toBackWidth + to.spineWidth;
  return {
    width: to.totalWidth,
    height: to.totalHeight,
    panels,
    effectiveDpi,
    guides: {
      trimLeft: to.bleed,
      spineLeft,
      spineRight,
      trimRight: to.totalWidth - to.bleed,
      trimTop: to.bleed,
      trimBottom: to.totalHeight - to.bleed,
    },
    warnings,
  };
}
