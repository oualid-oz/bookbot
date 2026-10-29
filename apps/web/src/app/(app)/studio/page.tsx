'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { calculateCoverDimensions } from '@bookbot/core';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldGroup, FieldLabel, FieldSeparator } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// Konva requires the browser canvas, so skip server rendering
const CoverCanvas = dynamic(() => import('./cover-canvas'), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full" />,
});

const TRIM_OPTIONS = [
  { value: '5x8', label: '5" x 8"' },
  { value: '5.5x8.5', label: '5.5" x 8.5"' },
  { value: '6x9', label: '6" x 9"' },
  { value: '7x10', label: '7" x 10"' },
  { value: '8.5x11', label: '8.5" x 11"' },
];

const PAPER_OPTIONS = [
  { value: 'white', label: 'White' },
  { value: 'cream', label: 'Cream' },
  { value: 'color', label: 'Color' },
];

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

  const dimensions = [
    ['Width', `${coverDims.width}"`],
    ['Height', `${coverDims.height}"`],
    ['Spine', `${coverDims.spineWidth.toFixed(3)}"`],
    ['Total width', `${coverDims.totalWidth.toFixed(3)}"`],
    ['Bleed', `${coverDims.bleed}"`],
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cover Editor</h1>
        <p className="text-muted-foreground">Set your book specs to size the full wrap-around cover.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Project settings</CardTitle>
            <CardDescription>KDP paperback specifications</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="trim-size">Trim size</FieldLabel>
                <Select
                  value={projectState.trimSize}
                  onValueChange={(trimSize) => setProjectState({ ...projectState, trimSize })}
                >
                  <SelectTrigger id="trim-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIM_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="page-count">Page count</FieldLabel>
                <Input
                  id="page-count"
                  type="number"
                  min={1}
                  value={projectState.pageCount}
                  onChange={(e) => {
                    const pageCount = parseInt(e.target.value);
                    if (!Number.isNaN(pageCount)) setProjectState({ ...projectState, pageCount });
                  }}
                />
              </Field>

              <Field>
                <FieldLabel htmlFor="paper-type">Paper type</FieldLabel>
                <Select
                  value={projectState.paperType}
                  onValueChange={(paperType) => setProjectState({ ...projectState, paperType })}
                >
                  <SelectTrigger id="paper-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAPER_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                Cover dimensions
              </FieldSeparator>

              <dl className="grid grid-cols-2 gap-y-1.5 text-sm">
                {dimensions.map(([label, value]) => (
                  <div key={label} className="contents">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </FieldGroup>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Cover canvas</CardTitle>
            <CardDescription>Back cover, spine, and front cover</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border">
              <CoverCanvas coverDims={coverDims} scale={scale} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
