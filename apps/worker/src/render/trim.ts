import sharp from 'sharp';

/**
 * Remove the empty border around an image: transparent pixels, or a solid
 * background matching the top-left corner. Returns a PNG, or null when there
 * is nothing to trim (or the image can't be read).
 */
export async function trimImage(bytes: Uint8Array): Promise<Uint8Array | null> {
  try {
    const { data, info } = await sharp(bytes).trim({ threshold: 12 }).png().toBuffer({ resolveWithObject: true });
    const original = await sharp(bytes).metadata();
    if (info.width === original.width && info.height === original.height) return null;
    return new Uint8Array(data);
  } catch {
    // An image of one solid color has nothing left after trimming
    return null;
  }
}
