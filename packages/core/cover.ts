/**
 * Cover layout shared by the editor canvas and the PDF renderer, so both put
 * every element in the same place. Units are inches from the top-left corner
 * of the full wrap (bleed included); font sizes are in points.
 */
import { calculateCoverDimensions, canHaveSpineText } from './kdp';

export interface CoverLayoutInput {
  trimSize: string;
  pageCount: number;
  paper: string;
  title: string;
  subtitle: string;
  author: string;
  backText: string;
  backgroundColor: string;
  spineColor: string;
  textColor: string;
  titleSize: number;
  /** Background images with their pixel size; null for none */
  frontImage?: CoverImage | null;
  backImage?: CoverImage | null;
}

export interface CoverImage {
  assetId: string;
  width: number;
  height: number;
}

/** KDP recommends at least 300 DPI at print size */
export const MIN_PRINT_DPI = 300;

export type CoverElement =
  | { kind: 'rect'; x: number; y: number; width: number; height: number; color: string }
  | {
      /** Fills the box; `crop` is the part of the image shown, in image pixels */
      kind: 'image';
      panel: 'front' | 'back';
      assetId: string;
      x: number;
      y: number;
      width: number;
      height: number;
      crop: { x: number; y: number; width: number; height: number };
      /** Resolution the image prints at */
      effectiveDpi: number;
    }
  | {
      kind: 'text';
      text: string;
      x: number;
      y: number;
      /** Text wraps within this width */
      width: number;
      size: number;
      color: string;
      bold: boolean;
      align: 'left' | 'center';
    }
  | {
      /** Reads top to bottom, centered on (centerX, centerY) */
      kind: 'spineText';
      text: string;
      centerX: number;
      centerY: number;
      maxLength: number;
      size: number;
      color: string;
    };

export interface CoverLayout {
  width: number;
  height: number;
  /** Trim and spine guide lines for the editor (not printed) */
  guides: { trimLeft: number; spineLeft: number; spineRight: number; trimRight: number; trimTop: number; trimBottom: number };
  elements: CoverElement[];
}

/** Keep text this far inside the trim line (KDP recommends at least 0.125") */
export const COVER_SAFE_MARGIN = 0.5;
export const LINE_HEIGHT = 1.2;

/**
 * Fill a box with an image like CSS `object-fit: cover`: scale until both
 * sides are covered, crop the overflow evenly
 */
export function coverFit(imageWidth: number, imageHeight: number, boxWidth: number, boxHeight: number) {
  const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight); // inches per pixel
  const width = boxWidth / scale;
  const height = boxHeight / scale;
  return {
    crop: { x: (imageWidth - width) / 2, y: (imageHeight - height) / 2, width, height },
    effectiveDpi: Math.round(1 / scale),
  };
}

function imageElement(panel: 'front' | 'back', image: CoverImage, x: number, width: number, height: number): CoverElement {
  return { kind: 'image', panel, assetId: image.assetId, x, y: 0, width, height, ...coverFit(image.width, image.height, width, height) };
}

export function layoutCover(input: CoverLayoutInput): CoverLayout {
  const dims = calculateCoverDimensions(input.trimSize, input.pageCount, input.paper);
  const { bleed, width: trimWidth, height: trimHeight, spineWidth } = dims;
  const spineLeft = bleed + trimWidth;
  const frontLeft = spineLeft + spineWidth;
  const textWidth = trimWidth - COVER_SAFE_MARGIN * 2;
  const top = bleed;

  const elements: CoverElement[] = [
    { kind: 'rect', x: 0, y: 0, width: dims.totalWidth, height: dims.totalHeight, color: input.backgroundColor },
    { kind: 'rect', x: spineLeft, y: 0, width: spineWidth, height: dims.totalHeight, color: input.spineColor },
  ];

  // Background images cover their whole panel, bleed included
  if (input.backImage) {
    elements.push(imageElement('back', input.backImage, 0, spineLeft, dims.totalHeight));
  }
  if (input.frontImage) {
    elements.push(imageElement('front', input.frontImage, frontLeft, dims.totalWidth - frontLeft, dims.totalHeight));
  }

  const text = (t: string, x: number, y: number, size: number, bold: boolean, align: 'left' | 'center') => {
    if (t.trim()) {
      elements.push({ kind: 'text', text: t.trim(), x, y, width: textWidth, size, color: input.textColor, bold, align });
    }
  };

  // Front cover: title block in the upper third, author near the bottom
  text(input.title, frontLeft + COVER_SAFE_MARGIN, top + trimHeight * 0.22, input.titleSize, true, 'center');
  text(input.subtitle, frontLeft + COVER_SAFE_MARGIN, top + trimHeight * 0.5, Math.round(input.titleSize * 0.4), false, 'center');
  text(input.author, frontLeft + COVER_SAFE_MARGIN, top + trimHeight - COVER_SAFE_MARGIN - 0.6, 16, true, 'center');

  // Back cover: blurb from the top
  text(input.backText, bleed + COVER_SAFE_MARGIN, top + COVER_SAFE_MARGIN + 0.25, 11, false, 'left');

  // Spine: KDP needs 0.0625" clearance each side, and more than 79 pages
  const spineText = [input.title.trim(), input.author.trim()].filter(Boolean).join('  ·  ');
  if (spineText && canHaveSpineText(input.pageCount)) {
    elements.push({
      kind: 'spineText',
      text: spineText,
      centerX: spineLeft + spineWidth / 2,
      centerY: dims.totalHeight / 2,
      maxLength: trimHeight - 1,
      size: Math.min((spineWidth - 0.125) * 72 * 0.8, 14),
      color: input.textColor,
    });
  }

  return {
    width: dims.totalWidth,
    height: dims.totalHeight,
    guides: {
      trimLeft: bleed,
      spineLeft,
      spineRight: frontLeft,
      trimRight: frontLeft + trimWidth,
      trimTop: bleed,
      trimBottom: bleed + trimHeight,
    },
    elements,
  };
}
