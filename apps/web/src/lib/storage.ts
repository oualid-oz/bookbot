import { eq } from 'drizzle-orm';
import { db } from '@bookbot/db';
import { assets } from '@bookbot/db/schema';
import sharp from 'sharp';

/**
 * Generate presigned URL for upload (placeholder - requires AWS SDK or R2 SDK)
 * In production, use @aws-sdk/client-s3 or @cloudflare/r2
 */
export async function generatePresignedUploadUrl(
  orgId: string,
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; key: string }> {
  // Placeholder implementation
  // In production, use S3/R2 SDK to generate presigned URL
  const key = `assets/${orgId}/${Date.now()}-${fileName}`;
  const uploadUrl = `https://${process.env.R2_PUBLIC_URL}/${key}`;
  
  return { uploadUrl, key };
}

/**
 * Validate uploaded image (DPI, dimensions)
 */
export async function validateImage(
  file: File | Buffer,
  minDPI: number = 300
): Promise<{ valid: boolean; width: number; height: number; dpi: number; error?: string }> {
  try {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const metadata = await sharp(buffer).metadata();
    
    const width = metadata.width || 0;
    const height = metadata.height || 0;
    
    // Estimate DPI from resolution if available
    // Note: This is simplified - actual DPI validation requires embedded metadata
    const dpi = metadata.density?.x || 72;
    
    if (dpi < minDPI) {
      return {
        valid: false,
        width,
        height,
        dpi,
        error: `Image DPI (${dpi}) is below minimum (${minDPI})`,
      };
    }
    
    return { valid: true, width, height, dpi };
  } catch (err) {
    return {
      valid: false,
      width: 0,
      height: 0,
      dpi: 0,
      error: 'Failed to process image',
    };
  }
}

/**
 * Save asset metadata to database
 */
export async function saveAsset(
  orgId: string,
  r2Key: string,
  kind: 'image' | 'font' | 'other',
  width: number,
  height: number,
  dpi: number,
  size: number,
  mimeType: string
) {
  await db.insert(assets).values({
    orgId,
    r2Key,
    kind,
    width,
    height,
    dpi,
    size,
    mimeType,
  });
}

/**
 * Get asset by ID
 */
export async function getAsset(assetId: string) {
  const asset = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);

  return asset[0] || null;
}

/**
 * Get assets by organization
 */
export async function getOrgAssets(orgId: string) {
  return db
    .select()
    .from(assets)
    .where(eq(assets.orgId, orgId))
    .orderBy(assets.createdAt);
}
