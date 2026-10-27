'use client';

import { useState } from 'react';
import { Stage, Layer, Rect, Text } from 'react-konva';
import { calculateCoverDimensions } from '@bookbot/core';

export default function StudioPage() {
  const [projectState, setProjectState] = useState({
    trimSize: '6x9',
    pageCount: 100,
    paperType: 'white',
  });

  const coverDims = calculateCoverDimensions(
    projectState.trimSize,
    projectState.pageCount,
    projectState.paperType
  );

  // Scale for display (1 inch = 50 pixels)
  const scale = 50;

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Studio - Cover Editor</h1>

        <div className="grid grid-cols-3 gap-6">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Project Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Trim Size</label>
                <select
                  value={projectState.trimSize}
                  onChange={(e) => setProjectState({ ...projectState, trimSize: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="5x8">5" x 8"</option>
                  <option value="5.5x8.5">5.5" x 8.5"</option>
                  <option value="6x9">6" x 9"</option>
                  <option value="7x10">7" x 10"</option>
                  <option value="8.5x11">8.5" x 11"</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Page Count</label>
                <input
                  type="number"
                  value={projectState.pageCount}
                  onChange={(e) => setProjectState({ ...projectState, pageCount: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Paper Type</label>
                <select
                  value={projectState.paperType}
                  onChange={(e) => setProjectState({ ...projectState, paperType: e.target.value })}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="white">White</option>
                  <option value="cream">Cream</option>
                  <option value="color">Color</option>
                </select>
              </div>

              <div className="pt-4 border-t">
                <h3 className="text-sm font-medium mb-2">Cover Dimensions</h3>
                <div className="text-sm space-y-1">
                  <div>Width: {coverDims.width}"</div>
                  <div>Height: {coverDims.height}"</div>
                  <div>Spine: {coverDims.spineWidth.toFixed(3)}"</div>
                  <div>Total Width: {coverDims.totalWidth.toFixed(3)}"</div>
                  <div>Bleed: {coverDims.bleed}"</div>
                </div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold mb-4">Cover Canvas</h2>
            <div className="border border-gray-300 rounded overflow-auto">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
