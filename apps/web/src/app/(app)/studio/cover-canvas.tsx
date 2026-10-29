'use client';

import { Stage, Layer, Rect, Text } from 'react-konva';
import type { calculateCoverDimensions } from '@bookbot/core';

interface CoverCanvasProps {
  coverDims: ReturnType<typeof calculateCoverDimensions>;
  scale: number;
}

export default function CoverCanvas({ coverDims, scale }: CoverCanvasProps) {
  return (
    <Stage
      width={coverDims.totalWidth * scale}
      height={coverDims.height * scale}
      scale={{ x: scale, y: scale }}
    >
      <Layer>
        {/* Back cover */}
        <Rect
          x={0}
          y={0}
          width={coverDims.width}
          height={coverDims.height}
          fill="#f0f0f0"
          stroke="#ccc"
          strokeWidth={0.01}
        />
        <Text
          x={coverDims.width / 2}
          y={coverDims.height / 2}
          text="Back Cover"
          fontSize={0.5}
          align="center"
          verticalAlign="middle"
        />

        {/* Spine */}
        <Rect
          x={coverDims.width}
          y={0}
          width={coverDims.spineWidth}
          height={coverDims.height}
          fill="#e0e0e0"
          stroke="#ccc"
          strokeWidth={0.01}
        />
        <Text
          x={coverDims.width + coverDims.spineWidth / 2}
          y={coverDims.height / 2}
          text="Spine"
          fontSize={0.3}
          align="center"
          verticalAlign="middle"
          rotation={-90}
        />

        {/* Front cover */}
        <Rect
          x={coverDims.width + coverDims.spineWidth}
          y={0}
          width={coverDims.width}
          height={coverDims.height}
          fill="#f5f5f5"
          stroke="#ccc"
          strokeWidth={0.01}
        />
        <Text
          x={coverDims.width + coverDims.spineWidth + coverDims.width / 2}
          y={coverDims.height / 2}
          text="Front Cover"
          fontSize={0.5}
          align="center"
          verticalAlign="middle"
        />
      </Layer>
    </Stage>
  );
}
