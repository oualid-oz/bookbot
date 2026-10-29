'use client';

import { useRef, useState } from 'react';
import { AlertTriangleIcon, ImageIcon, Loader2Icon, Trash2Icon, UploadIcon } from 'lucide-react';
import { toast } from 'sonner';
import { MIN_PRINT_DPI } from '@bookbot/core';
import { IMAGE_TYPES, MAX_IMAGE_BYTES } from '@bookbot/shared';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { apiFetch } from '@/lib/api-client';

export interface UploadedImage {
  id: string;
  width: number;
  height: number;
  url: string;
}

/**
 * Upload an image in three steps: reserve, upload (straight to the bucket
 * when the storage presigns), then have the server verify it
 */
async function uploadImage(file: File): Promise<UploadedImage> {
  const { asset, upload } = await apiFetch<{
    asset: { id: string };
    upload: { url: string; method: string; headers: Record<string, string> };
  }>('/api/assets', { method: 'POST', body: { name: file.name, contentType: file.type, size: file.size } });

  const put = await fetch(upload.url, { method: upload.method, headers: upload.headers, body: file });
  if (!put.ok) throw new Error('Upload failed');

  const { asset: ready } = await apiFetch<{ asset: UploadedImage }>(`/api/assets/${asset.id}/complete`, { method: 'POST' });
  return ready;
}

export function ImageField({
  id,
  label,
  image,
  effectiveDpi,
  onChange,
}: {
  id: string;
  label: string;
  image: UploadedImage | null;
  /** Resolution at print size, from the layout */
  effectiveDpi: number | null;
  onChange: (image: UploadedImage | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!(IMAGE_TYPES as readonly string[]).includes(file.type)) {
      toast.error('Use a PNG or JPEG image');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error('Images can be at most 25 MB');
      return;
    }
    setUploading(true);
    try {
      onChange(await uploadImage(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (input.current) input.current.value = '';
    }
  };

  const lowResolution = image && effectiveDpi !== null && effectiveDpi < MIN_PRINT_DPI;

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-3">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element -- private, auth-checked asset URL
            <img src={image.url} alt="" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2Icon className="animate-spin" /> : <UploadIcon />}
            {image ? 'Replace' : 'Upload'}
          </Button>
          {image && (
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${label.toLowerCase()}`} onClick={() => onChange(null)}>
              <Trash2Icon />
            </Button>
          )}
        </div>
        <input ref={input} id={id} type="file" accept={IMAGE_TYPES.join(',')} className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])} />
      </div>
      {lowResolution ? (
        <FieldDescription className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
          <AlertTriangleIcon className="size-4" />
          Prints at {effectiveDpi} DPI; KDP recommends {MIN_PRINT_DPI}. Use a larger image.
        </FieldDescription>
      ) : image && effectiveDpi !== null ? (
        <FieldDescription>{image.width} × {image.height} px · prints at {effectiveDpi} DPI</FieldDescription>
      ) : (
        <FieldDescription>PNG or JPEG, fills the whole panel.</FieldDescription>
      )}
    </Field>
  );
}
