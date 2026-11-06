import type { CoverConversion } from '@bookbot/core';

/** Draw the converted cover onto a canvas, `dpi` pixels per printed inch */
export function drawConversion(canvas: HTMLCanvasElement, image: CanvasImageSource, plan: CoverConversion, dpi: number) {
  canvas.width = Math.round(plan.width * dpi);
  canvas.height = Math.round(plan.height * dpi);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not start drawing in this browser');
  ctx.imageSmoothingQuality = 'high';
  // Printed pages have no transparency
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const { source, dest } of plan.panels) {
    ctx.drawImage(image, source.x, source.y, source.width, source.height, dest.x * dpi, dest.y * dpi, dest.width * dpi, dest.height * dpi);
  }
  return ctx;
}

/** Trim and spine lines, for the preview only */
export function drawGuides(ctx: CanvasRenderingContext2D, plan: CoverConversion, dpi: number) {
  const { trimLeft, spineLeft, spineRight, trimRight, trimTop, trimBottom } = plan.guides;
  ctx.save();
  ctx.setLineDash([6, 4]);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#ef4444';
  ctx.strokeRect(trimLeft * dpi, trimTop * dpi, (trimRight - trimLeft) * dpi, (trimBottom - trimTop) * dpi);
  ctx.strokeStyle = '#3b82f6';
  for (const x of [spineLeft, spineRight]) {
    ctx.beginPath();
    ctx.moveTo(x * dpi, 0);
    ctx.lineTo(x * dpi, plan.height * dpi);
    ctx.stroke();
  }
  ctx.restore();
}

/** A one-page PDF of the image at exactly the printed size */
export async function buildCoverPdf(bytes: Uint8Array, mimeType: 'image/png' | 'image/jpeg', widthInches: number, heightInches: number): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.create();
  doc.setCreator('Bookbot');
  const image = mimeType === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
  const width = widthInches * 72;
  const height = heightInches * 72;
  doc.addPage([width, height]).drawImage(image, { x: 0, y: 0, width, height });
  return doc.save();
}

/** Render the full-resolution cover and return it as a PDF */
export async function exportCoverPdf(image: CanvasImageSource, plan: CoverConversion, mimeType: 'image/png' | 'image/jpeg'): Promise<Blob> {
  // At least print quality, and no more detail than the source has
  const dpi = Math.min(600, Math.max(300, plan.effectiveDpi));
  const canvas = document.createElement('canvas');
  drawConversion(canvas, image, plan, dpi);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mimeType, 0.95));
  if (!blob) throw new Error('This image is too large for your browser to convert');
  const pdf = await buildCoverPdf(new Uint8Array(await blob.arrayBuffer()), mimeType, plan.width, plan.height);
  return new Blob([pdf as BlobPart], { type: 'application/pdf' });
}
