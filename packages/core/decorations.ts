/**
 * Page borders and background patterns for book interiors, as SVG paths in
 * points with the origin at the page's top-left. The PDF renderer and the
 * web preview both draw these, so they always match.
 */

export const BORDER_STYLES = ['none', 'line', 'double', 'rounded', 'dashed', 'dotted', 'corners', 'wavy', 'stars'] as const;
export type BorderStyle = (typeof BORDER_STYLES)[number];

export const BACKGROUND_PATTERNS = ['none', 'polka', 'grid', 'diagonal', 'stars', 'confetti'] as const;
export type BackgroundPattern = (typeof BACKGROUND_PATTERNS)[number];

export const BACKGROUND_INTENSITIES = ['light', 'medium'] as const;
export type BackgroundIntensity = (typeof BACKGROUND_INTENSITIES)[number];

const PT = 72;

/**
 * Distance of the frame from the page's top, bottom and outside edges. KDP
 * needs 0.25" on no-bleed interiors; the gutter side uses the full inside margin.
 */
export const FRAME_EDGE_INCHES = 0.3;

/** Space between the frame and the page content, in points */
export const FRAME_PADDING = { small: 18, medium: 36, large: 54 } as const;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DecorShape {
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: number[];
  opacity?: number;
}

export interface DecorationInput {
  /** Page size in points */
  width: number;
  height: number;
  frame: Rect;
  border: BorderStyle;
  borderColor: string;
  background: BackgroundPattern;
  backgroundColor: string;
  intensity: BackgroundIntensity;
  /** Scattered patterns (stars, confetti) vary with this */
  seed: number;
}

/**
 * The area a border or background fills: inside the safe margins, with the
 * gutter on the left of right-hand (odd) pages
 */
export function decorationFrame(pageWidth: number, pageHeight: number, insideMarginInches: number, isRightHand: boolean): Rect {
  const edge = FRAME_EDGE_INCHES * PT;
  const inside = insideMarginInches * PT;
  const left = isRightHand ? inside : edge;
  const right = isRightHand ? edge : inside;
  return { x: left, y: edge, width: pageWidth - left - right, height: pageHeight - 2 * edge };
}

/** KDP black-and-white interiors print in grey: the color's grey value */
export function printColor(hex: string, colorPaper: boolean): string {
  if (colorPaper) return hex;
  const n = parseInt(hex.slice(1), 16);
  const gray = Math.round(0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255));
  const h = gray.toString(16).padStart(2, '0');
  return `#${h}${h}${h}`;
}

// ---- Path helpers ----

const f = (n: number) => Number(n.toFixed(2));

function rectPath({ x, y, width, height }: Rect, radius = 0) {
  if (!radius) return `M${f(x)} ${f(y)}H${f(x + width)}V${f(y + height)}H${f(x)}Z`;
  const r = Math.min(radius, width / 2, height / 2);
  const k = r * 0.5523; // cubic approximation of a quarter circle
  return [
    `M${f(x + r)} ${f(y)}H${f(x + width - r)}`,
    `C${f(x + width - r + k)} ${f(y)} ${f(x + width)} ${f(y + r - k)} ${f(x + width)} ${f(y + r)}`,
    `V${f(y + height - r)}`,
    `C${f(x + width)} ${f(y + height - r + k)} ${f(x + width - r + k)} ${f(y + height)} ${f(x + width - r)} ${f(y + height)}`,
    `H${f(x + r)}`,
    `C${f(x + r - k)} ${f(y + height)} ${f(x)} ${f(y + height - r + k)} ${f(x)} ${f(y + height - r)}`,
    `V${f(y + r)}`,
    `C${f(x)} ${f(y + r - k)} ${f(x + r - k)} ${f(y)} ${f(x + r)} ${f(y)}Z`,
  ].join('');
}

function circlePath(cx: number, cy: number, r: number) {
  const k = r * 0.5523;
  return [
    `M${f(cx + r)} ${f(cy)}`,
    `C${f(cx + r)} ${f(cy + k)} ${f(cx + k)} ${f(cy + r)} ${f(cx)} ${f(cy + r)}`,
    `C${f(cx - k)} ${f(cy + r)} ${f(cx - r)} ${f(cy + k)} ${f(cx - r)} ${f(cy)}`,
    `C${f(cx - r)} ${f(cy - k)} ${f(cx - k)} ${f(cy - r)} ${f(cx)} ${f(cy - r)}`,
    `C${f(cx + k)} ${f(cy - r)} ${f(cx + r)} ${f(cy - k)} ${f(cx + r)} ${f(cy)}Z`,
  ].join('');
}

function starPath(cx: number, cy: number, r: number, rotation = 0) {
  const points = Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 === 0 ? r : r * 0.45;
    const angle = rotation - Math.PI / 2 + (i * Math.PI) / 5;
    return `${f(cx + radius * Math.cos(angle))} ${f(cy + radius * Math.sin(angle))}`;
  });
  return `M${points.join('L')}Z`;
}

function polygonPath(points: [number, number][]) {
  return `M${points.map(([x, y]) => `${f(x)} ${f(y)}`).join('L')}Z`;
}

/** Evenly spaced points around a rectangle, one on each corner */
function perimeterPoints({ x, y, width, height }: Rect, spacing: number): [number, number][] {
  const points: [number, number][] = [];
  const edge = (x1: number, y1: number, x2: number, y2: number) => {
    const length = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.round(length / spacing));
    for (let i = 0; i < steps; i++) points.push([x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps]);
  };
  edge(x, y, x + width, y);
  edge(x + width, y, x + width, y + height);
  edge(x + width, y + height, x, y + height);
  edge(x, y + height, x, y);
  return points;
}

/** Small deterministic random numbers, so a page looks the same in every export */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Borders ----

function borderShapes(frame: Rect, style: BorderStyle, color: string): DecorShape[] {
  const line = (d: string, strokeWidth = 1.5, dash?: number[]): DecorShape => ({ d, stroke: color, strokeWidth, dash });
  const fill = (d: string): DecorShape => ({ d, fill: color });
  const inset = (r: Rect, by: number): Rect => ({ x: r.x + by, y: r.y + by, width: r.width - 2 * by, height: r.height - 2 * by });

  switch (style) {
    case 'none':
      return [];
    case 'line':
      return [line(rectPath(frame))];
    case 'double':
      return [line(rectPath(frame), 2), line(rectPath(inset(frame, 4)), 0.75)];
    case 'rounded':
      return [line(rectPath(frame, 16), 1.75)];
    case 'dashed':
      return [line(rectPath(frame), 1.25, [6, 4])];
    case 'dotted':
      return perimeterPoints(frame, 9).map(([x, y]) => fill(circlePath(x, y, 1.6)));
    case 'stars':
      return perimeterPoints(frame, 22).map(([x, y]) => fill(starPath(x, y, 5)));

    case 'wavy': {
      // Scallops along each edge, curving outward
      const amplitude = 3.5;
      const parts: string[] = [];
      const edge = (x1: number, y1: number, x2: number, y2: number, nx: number, ny: number) => {
        const steps = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 14));
        for (let i = 0; i < steps; i++) {
          const ax = x1 + ((x2 - x1) * i) / steps;
          const ay = y1 + ((y2 - y1) * i) / steps;
          const bx = x1 + ((x2 - x1) * (i + 1)) / steps;
          const by = y1 + ((y2 - y1) * (i + 1)) / steps;
          if (!parts.length) parts.push(`M${f(ax)} ${f(ay)}`);
          parts.push(`Q${f((ax + bx) / 2 + nx * amplitude * 2)} ${f((ay + by) / 2 + ny * amplitude * 2)} ${f(bx)} ${f(by)}`);
        }
      };
      const { x, y, width, height } = frame;
      edge(x, y, x + width, y, 0, -1);
      edge(x + width, y, x + width, y + height, 1, 0);
      edge(x + width, y + height, x, y + height, 0, 1);
      edge(x, y + height, x, y, -1, 0);
      return [line(`${parts.join('')}Z`, 1.25)];
    }

    case 'corners': {
      // Thin frame with an inner bracket and a diamond at each corner
      const shapes: DecorShape[] = [line(rectPath(frame), 0.75)];
      const size = Math.min(36, frame.width / 5, frame.height / 5);
      const gap = 5;
      const corners: [number, number, number, number][] = [
        [frame.x, frame.y, 1, 1],
        [frame.x + frame.width, frame.y, -1, 1],
        [frame.x + frame.width, frame.y + frame.height, -1, -1],
        [frame.x, frame.y + frame.height, 1, -1],
      ];
      for (const [cx, cy, sx, sy] of corners) {
        const bx = cx + sx * gap;
        const by = cy + sy * gap;
        shapes.push(line(`M${f(bx)} ${f(by + sy * size)}L${f(bx)} ${f(by)}L${f(bx + sx * size)} ${f(by)}`, 2));
        const dx = bx + sx * 7;
        const dy = by + sy * 7;
        shapes.push(fill(polygonPath([[dx, dy - 3.5], [dx + 3.5, dy], [dx, dy + 3.5], [dx - 3.5, dy]])));
      }
      return shapes;
    }
  }
}

// ---- Backgrounds ----

/** Diagonal lines (x - y = c) clipped to the rectangle */
function diagonalLines({ x, y, width, height }: Rect, spacing: number) {
  const parts: string[] = [];
  for (let c = -height; c < width; c += spacing) {
    // Points where the line enters and leaves the rectangle, in rectangle coordinates
    const x1 = Math.max(0, c);
    const y1 = x1 - c;
    const x2 = Math.min(width, c + height);
    const y2 = x2 - c;
    if (x2 > x1) parts.push(`M${f(x + x1)} ${f(y + y1)}L${f(x + x2)} ${f(y + y2)}`);
  }
  return parts.join('');
}

function backgroundShapes(area: Rect, pattern: BackgroundPattern, color: string, intensity: BackgroundIntensity, seed: number): DecorShape[] {
  const opacity = intensity === 'medium' ? 0.3 : 0.16;
  const fill = (d: string): DecorShape => ({ d, fill: color, opacity });
  const rng = random(seed);
  const { x, y, width, height } = area;

  switch (pattern) {
    case 'none':
      return [];
    case 'polka': {
      const step = 18;
      const r = 3;
      const dots: string[] = [];
      // Whole dots only, so none pokes out of the frame
      for (let row = 0, py = y + step / 2; py + r <= y + height; row++, py += step) {
        for (let px = x + (row % 2 ? step : step / 2); px + r <= x + width; px += step) dots.push(circlePath(px, py, r));
      }
      return [fill(dots.join(''))];
    }
    case 'grid': {
      const step = 18;
      const parts: string[] = [];
      for (let px = x + step; px < x + width; px += step) parts.push(`M${f(px)} ${f(y)}V${f(y + height)}`);
      for (let py = y + step; py < y + height; py += step) parts.push(`M${f(x)} ${f(py)}H${f(x + width)}`);
      return [{ d: parts.join(''), stroke: color, strokeWidth: 0.6, opacity: Math.min(opacity * 2, 0.5) }];
    }
    case 'diagonal':
      return [{ d: diagonalLines(area, 12), stroke: color, strokeWidth: 3, opacity }];
    case 'stars': {
      const count = Math.round((width * height) / 2600);
      const stars = Array.from({ length: count }, () =>
        starPath(x + 6 + rng() * (width - 12), y + 6 + rng() * (height - 12), 3 + rng() * 4, rng() * Math.PI)
      );
      return [fill(stars.join(''))];
    }
    case 'confetti': {
      const count = Math.round((width * height) / 1500);
      const pieces = Array.from({ length: count }, () => {
        const cx = x + 4 + rng() * (width - 8);
        const cy = y + 4 + rng() * (height - 8);
        const size = 2 + rng() * 3;
        const angle = rng() * Math.PI;
        const kind = rng();
        if (kind < 0.35) return circlePath(cx, cy, size * 0.7);
        if (kind < 0.7) {
          // A small rotated strip
          const dx = Math.cos(angle) * size * 1.4;
          const dy = Math.sin(angle) * size * 1.4;
          const nx = -Math.sin(angle) * size * 0.45;
          const ny = Math.cos(angle) * size * 0.45;
          return polygonPath([[cx - dx + nx, cy - dy + ny], [cx + dx + nx, cy + dy + ny], [cx + dx - nx, cy + dy - ny], [cx - dx - nx, cy - dy - ny]]);
        }
        return polygonPath([0, 1, 2].map((i) => [cx + size * Math.cos(angle + (i * 2 * Math.PI) / 3), cy + size * Math.sin(angle + (i * 2 * Math.PI) / 3)]));
      });
      return [fill(pieces.join(''))];
    }
  }
}

/** Shapes for one page: background first, then the border on top */
export function pageDecorations(input: DecorationInput): DecorShape[] {
  return [
    ...backgroundShapes(input.frame, input.background, input.backgroundColor, input.intensity, input.seed),
    ...borderShapes(input.frame, input.border, input.borderColor),
  ];
}
