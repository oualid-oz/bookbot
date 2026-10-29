'use client';

import { Layer, Line, Rect, Stage, Text } from 'react-konva';
import { LINE_HEIGHT, type CoverLayout } from '@bookbot/core';

const FONT_FAMILY = 'Helvetica, Arial, sans-serif';

/**
 * Draws a cover layout. Coordinates are inches, scaled to pixels; font sizes
 * are points, so divide by 72 to get inches.
 */
export default function CoverPreview({ layout, pxPerInch }: { layout: CoverLayout; pxPerInch: number }) {
  const { guides } = layout;
  const guide = { stroke: '#22d3ee', strokeWidth: 1 / pxPerInch, dash: [0.06, 0.06], listening: false };

  return (
    <Stage width={layout.width * pxPerInch} height={layout.height * pxPerInch} scale={{ x: pxPerInch, y: pxPerInch }}>
      <Layer listening={false}>
        {layout.elements.map((el, i) => {
          if (el.kind === 'rect') {
            return <Rect key={i} x={el.x} y={el.y} width={el.width} height={el.height} fill={el.color} />;
          }
          if (el.kind === 'text') {
            return (
              <Text key={i} x={el.x} y={el.y} width={el.width} text={el.text} fontSize={el.size / 72}
                fontFamily={FONT_FAMILY} fontStyle={el.bold ? 'bold' : 'normal'} fill={el.color}
                align={el.align} lineHeight={LINE_HEIGHT} wrap="word" />
            );
          }
          // Rotated 90° clockwise so it reads top to bottom, centered on the spine
          const size = el.size / 72;
          return (
            <Text key={i} x={el.centerX + size / 2} y={el.centerY - el.maxLength / 2} width={el.maxLength}
              text={el.text} fontSize={size} fontFamily={FONT_FAMILY} fontStyle="bold" fill={el.color}
              align="center" rotation={90} wrap="none" ellipsis />
          );
        })}

        {/* Guides: trim edges and spine folds (not printed) */}
        {[guides.trimLeft, guides.spineLeft, guides.spineRight, guides.trimRight].map((x) => (
          <Line key={`v${x}`} points={[x, 0, x, layout.height]} {...guide} />
        ))}
        {[guides.trimTop, guides.trimBottom].map((y) => (
          <Line key={`h${y}`} points={[0, y, layout.width, y]} {...guide} />
        ))}
      </Layer>
    </Stage>
  );
}
