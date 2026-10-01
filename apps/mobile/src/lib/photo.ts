import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/** Same as the web: at most 2048 px on the long edge, JPEG at 0.9. */
export const MAX_EDGE = 2048;
const QUALITY = 0.9;

export type Photo = { uri: string; width: number; height: number };

/** The size to shrink to, or null when the photo is already small enough. */
export function fitWithin(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } | null {
  const scale = maxEdge / Math.max(width, height);
  if (scale >= 1) return null;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Shrinks and re-encodes a camera or library photo, ready for /api/scan. */
export async function preparePhoto(uri: string, width: number, height: number): Promise<Photo> {
  const target = fitWithin(width, height);
  const context = ImageManipulator.manipulate(uri);
  if (target) context.resize(target);
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}
