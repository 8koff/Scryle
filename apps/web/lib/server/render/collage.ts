import sharp from "sharp";

export type CollageOptions = {
  /** Each product is fitted into a square tile this many pixels wide. */
  tileSize?: number;
  gap?: number;
  maxWidth?: number;
};

const WHITE = { r: 255, g: 255, b: 255 };

/**
 * Puts product photos side by side, left to right, on white. Higgsfield charges per input
 * image, so sending one combined image instead of N keeps multi-item renders cheap.
 * The prompt refers to them as "product 1..N in image 2" (see buildEditPrompt).
 */
export async function combineProducts(images: readonly Uint8Array[], opts: CollageOptions = {}): Promise<Buffer> {
  if (images.length < 2) throw new Error("combineProducts needs at least two products");
  const gap = opts.gap ?? 32;
  const maxWidth = opts.maxWidth ?? 3072;
  const count = images.length;
  const tile = Math.min(opts.tileSize ?? 768, Math.floor((maxWidth - gap * (count - 1)) / count));

  const tiles = await Promise.all(
    images.map((image) =>
      sharp(image).flatten({ background: WHITE }).resize(tile, tile, { fit: "contain", background: WHITE }).png().toBuffer(),
    ),
  );

  return sharp({
    create: { width: tile * count + gap * (count - 1), height: tile, channels: 3, background: WHITE },
  })
    .composite(tiles.map((input, i) => ({ input, left: i * (tile + gap), top: 0 })))
    .jpeg({ quality: 90 })
    .toBuffer();
}
