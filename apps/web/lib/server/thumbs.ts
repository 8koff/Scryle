/**
 * Small previews of kept renders, for the iPhone app's swap lists. The full picture is up to
 * 1600 px; a list shows it about 180 points wide, so downloading the full one wastes data.
 */

/** Long side of a preview: sharp at 3x on the widest list tile. */
export const THUMB_MAX_PX = 600;
const THUMB_QUALITY = 78;

/** Stops "decompression bombs", same limit as the pictures we keep. */
const MAX_INPUT_PIXELS = 50_000_000;

/** A JPEG preview of one of our own kept pictures. */
export async function jpegThumb(bytes: Buffer): Promise<Buffer> {
  const { default: sharp } = await import("sharp");
  return sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(THUMB_MAX_PX, THUMB_MAX_PX, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: THUMB_QUALITY })
    .toBuffer();
}
