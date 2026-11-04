'use client';

import { useEffect, useState } from 'react';
import {
  BACKGROUND_PATTERNS,
  BORDER_STYLES,
  FRAME_PADDING,
  TRIM_SIZES,
  decorationFrame,
  getMinimumInsideMargin,
  pageDecorations,
  printColor,
  type BackgroundPattern,
  type BorderStyle,
} from '@bookbot/core';
import type { InteriorSettings } from '@bookbot/shared';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { ProjectSummary } from '@/components/project-options';
import { ImageField, type UploadedImage } from './cover/image-field';

type Decor = InteriorSettings['decor'];

const BORDER_NAMES: Record<BorderStyle, string> = {
  none: 'None',
  line: 'Simple line',
  double: 'Double line',
  rounded: 'Rounded',
  dashed: 'Dashed',
  dotted: 'Dotted',
  corners: 'Corner ornaments',
  wavy: 'Wavy',
  stars: 'Stars',
};

const BACKGROUND_NAMES: Record<BackgroundPattern, string> = {
  none: 'None',
  polka: 'Polka dots',
  grid: 'Grid',
  diagonal: 'Diagonal stripes',
  stars: 'Stars',
  confetti: 'Confetti',
};

/** Page geometry in points, for a right-hand page */
function pageGeometry(project: ProjectSummary) {
  const trim = TRIM_SIZES[project.trimSize] ?? TRIM_SIZES['6x9'];
  const width = trim.width * 72;
  const height = trim.height * 72;
  const frame = decorationFrame(width, height, getMinimumInsideMargin(project.pageCount), true);
  return { width, height, frame };
}

/** Resolution the image prints at, in its current mode */
export function decorImageDpi(project: ProjectSummary, decor: Decor, image: UploadedImage | null) {
  if (!image) return null;
  const { frame } = pageGeometry(project);
  // A watermark fills at most 80% of the content area; a frame fills the whole safe area
  const scale = decor.imageMode === 'frame' ? 1 : 0.8;
  const widthInches = (frame.width * scale) / 72;
  const heightInches = (frame.height * scale) / 72;
  return Math.floor(Math.min(image.width / widthInches, image.height / heightInches));
}

/** Where the artwork sits in an image, as fractions of its size */
interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The image without its empty border (transparent, or the top-left corner's
 * color), matching how exports trim frame images
 */
function useArtworkBounds(url: string | null): Bounds | null {
  const [bounds, setBounds] = useState<{ url: string; bounds: Bounds } | null>(null);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      // A small copy is enough to find the edges
      const scale = Math.min(1, 400 / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = Object.assign(document.createElement('canvas'), { width: w, height: h }).getContext('2d');
      if (!ctx || cancelled) return;
      ctx.drawImage(img, 0, 0, w, h);
      const px = ctx.getImageData(0, 0, w, h).data;
      const differs = (i: number) =>
        Math.abs(px[i + 3] - px[3]) > 12 ||
        (px[i + 3] > 12 && Math.abs(px[i] - px[0]) + Math.abs(px[i + 1] - px[1]) + Math.abs(px[i + 2] - px[2]) > 36);
      let [minX, minY, maxX, maxY] = [w, h, -1, -1];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (!differs((y * w + x) * 4)) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      const found = maxX < 0 ? { x: 0, y: 0, width: 1, height: 1 } : { x: minX / w, y: minY / h, width: (maxX - minX + 1) / w, height: (maxY - minY + 1) / h };
      setBounds({ url, bounds: found });
    };
    img.src = url;
    return () => {
      cancelled = true;
    };
  }, [url]);

  return url && bounds?.url === url ? bounds.bounds : null;
}

/** A right-hand page with the decorations and stand-in content */
export function PageDesignPreview({ project, decor, image, heading }: {
  project: ProjectSummary;
  decor: Decor;
  image: UploadedImage | null;
  /** Font and print color for the sample heading */
  heading?: { fontFamily: string; color: string };
}) {
  const { width, height, frame } = pageGeometry(project);
  const colorPaper = project.paper === 'color';
  const frameImage = image && decor.imageMode === 'frame' ? image : null;
  const artwork = useArtworkBounds(frameImage?.url ?? null) ?? { x: 0, y: 0, width: 1, height: 1 };
  const shapes = (border: BorderStyle, background: BackgroundPattern) =>
    pageDecorations({
      width,
      height,
      frame,
      border,
      borderColor: decor.borderColor,
      background,
      backgroundColor: decor.backgroundColor,
      intensity: decor.intensity,
      seed: 3,
    });
  const draw = (list: ReturnType<typeof shapes>) =>
    list.map((s, i) => (
      <path key={i} d={s.d} fill={s.fill ? printColor(s.fill, colorPaper) : 'none'} stroke={s.stroke ? printColor(s.stroke, colorPaper) : undefined}
        strokeWidth={s.strokeWidth} strokeDasharray={s.dash?.join(' ')} opacity={s.opacity} />
    ));

  // Stand-in content: a heading and a puzzle grid, inside the border like the real page
  const framed = decor.border !== 'none' || !!frameImage;
  const pad = FRAME_PADDING[decor.framePadding];
  const inside = getMinimumInsideMargin(project.pageCount) * 72;
  const left = framed ? Math.max(frame.x + pad, inside) : inside;
  const right = width - (framed ? Math.max(width - frame.x - frame.width + pad, 36) : 36);
  const top = framed ? Math.max(54, frame.y + pad) : 54;
  const grid = Math.min(right - left, height * 0.45);
  const gridX = left + (right - left - grid) / 2;
  const headingY = top + 14;
  const gridY = headingY + 22;
  const busy = decor.background !== 'none' || !!image;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full rounded-sm bg-white shadow-sm ring-1 ring-border" role="img" aria-label="Page preview">
      {draw(shapes('none', decor.background))}
      {frameImage && (
        // Only the artwork, stretched to the frame
        <svg x={frame.x} y={frame.y} width={frame.width} height={frame.height}
          viewBox={`${artwork.x} ${artwork.y} ${artwork.width} ${artwork.height}`} preserveAspectRatio="none">
          <image href={frameImage.url} width={1} height={1} preserveAspectRatio="none" style={colorPaper ? undefined : { filter: 'grayscale(1)' }} />
        </svg>
      )}
      {image && decor.imageMode === 'watermark' && (
        <image href={image.url} x={left} y={60} width={right - left} height={height - 120} opacity={decor.imageOpacity}
          style={colorPaper ? undefined : { filter: 'grayscale(1)' }} />
      )}
      {draw(shapes(decor.border, 'none'))}
      <text x={(left + right) / 2} y={headingY} textAnchor="middle" fontSize={18} fontWeight={700}
        fontFamily={heading?.fontFamily ?? 'Helvetica, Arial, sans-serif'} fill={heading?.color ?? '#000'}>
        Puzzle 1
      </text>
      {busy && <rect x={gridX - 4} y={gridY - 4} width={grid + 8} height={grid + 8} fill="white" />}
      {Array.from({ length: 9 }, (_, r) =>
        Array.from({ length: 9 }, (_, c) => (
          <rect key={`${r}-${c}`} x={gridX + (c * grid) / 9} y={gridY + (r * grid) / 9} width={grid / 9} height={grid / 9}
            fill="none" stroke="#a1a1aa" strokeWidth={0.75} />
        ))
      )}
      {Array.from({ length: 4 }, (_, i) => (
        <rect key={i} x={left} y={gridY + grid + 24 + i * 16} width={(right - left) * (i % 2 ? 0.6 : 0.8)} height={6} rx={3} fill="#d4d4d8" />
      ))}
    </svg>
  );
}

/** Border, background and image controls for the Interior card */
export function PageDesignFields({ project, decor, image, onChange, onImage }: {
  project: ProjectSummary;
  decor: Decor;
  image: UploadedImage | null;
  onChange: (changes: Partial<Decor>) => void;
  onImage: (image: UploadedImage | null) => void;
}) {
  const colorPaper = project.paper === 'color';

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="decor-border">Border</FieldLabel>
            <Select value={decor.border} onValueChange={(v) => onChange({ border: v as BorderStyle })}>
              <SelectTrigger id="decor-border" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BORDER_STYLES.map((s) => <SelectItem key={s} value={s}>{BORDER_NAMES[s]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {decor.border !== 'none' && (
            <Input type="color" aria-label="Border color" className="w-12 p-1" value={decor.borderColor}
              onChange={(e) => onChange({ borderColor: e.target.value })} />
          )}
        </div>

        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="decor-background">Background</FieldLabel>
            <Select value={decor.background} onValueChange={(v) => onChange({ background: v as BackgroundPattern })}>
              <SelectTrigger id="decor-background" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {BACKGROUND_PATTERNS.map((p) => <SelectItem key={p} value={p}>{BACKGROUND_NAMES[p]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          {decor.background !== 'none' && (
            <>
              <Select value={decor.intensity} onValueChange={(v) => onChange({ intensity: v as Decor['intensity'] })}>
                <SelectTrigger aria-label="Background strength" className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                </SelectContent>
              </Select>
              <Input type="color" aria-label="Background color" className="w-12 p-1" value={decor.backgroundColor}
                onChange={(e) => onChange({ backgroundColor: e.target.value })} />
            </>
          )}
        </div>
      </div>

      <ImageField id="decor-image" label="Your own graphic" image={image} effectiveDpi={decorImageDpi(project, decor, image)} onChange={onImage} />
      {image && (
        <div className="flex items-end gap-2">
          <Field className="flex-1">
            <FieldLabel htmlFor="decor-image-mode">Use it as</FieldLabel>
            <Select value={decor.imageMode} onValueChange={(v) => onChange({ imageMode: v as Decor['imageMode'] })}>
              <SelectTrigger id="decor-image-mode" className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="frame">Page frame (empty edges trimmed, stretched to fit)</SelectItem>
                <SelectItem value="watermark">Faded picture behind content</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {decor.imageMode === 'watermark' && (
            <Select value={String(decor.imageOpacity)} onValueChange={(v) => onChange({ imageOpacity: Number(v) })}>
              <SelectTrigger aria-label="Picture strength" className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[0.1, 0.2, 0.3, 0.5].map((o) => <SelectItem key={o} value={String(o)}>{Math.round(o * 100)}%</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {(decor.border !== 'none' || (image && decor.imageMode === 'frame')) && (
        <Field className="sm:max-w-[calc(50%-0.5rem)]">
          <FieldLabel htmlFor="decor-padding">Space inside frame</FieldLabel>
          <Select value={decor.framePadding} onValueChange={(v) => onChange({ framePadding: v as Decor['framePadding'] })}>
            <SelectTrigger id="decor-padding" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large (thick frame artwork)</SelectItem>
            </SelectContent>
          </Select>
          <FieldDescription>Room between the frame and the puzzles, so they never overlap.</FieldDescription>
        </Field>
      )}

      <FieldDescription>
        Applies to every page with content. Puzzles get a white area so they stay easy to read.
        {!colorPaper && ' Your interior is black and white, so colors print in grey (shown in the preview).'}
      </FieldDescription>
    </div>
  );
}
