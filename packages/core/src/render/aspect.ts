const RATIO = /^(\d+):(\d+)$/;

/**
 * Picks the allowed "w:h" aspect ratio closest to a photo's real size, so the
 * edited image keeps the photo's shape. Compares on a log scale so 2:1 and 1:2
 * are treated as equally far from 1:1.
 */
export function nearestAspectRatio<T extends string>(
  width: number,
  height: number,
  allowed: readonly T[],
): T {
  if (!(width > 0) || !(height > 0)) throw new Error(`Invalid image size ${width}x${height}`);

  const target = Math.log(width / height);
  let best: { value: T; distance: number } | undefined;

  for (const value of allowed) {
    const match = RATIO.exec(value);
    if (!match) continue;
    const ratio = Number(match[1]) / Number(match[2]);
    const distance = Math.abs(Math.log(ratio) - target);
    if (!best || distance < best.distance) best = { value, distance };
  }

  if (!best) throw new Error("No usable aspect ratio in the allowed list");
  return best.value;
}
