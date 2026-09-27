/**
 * Variance of the Laplacian on luminance: a standard, cheap blur score.
 * Run it on a small downscaled frame (e.g. 160px wide) every few frames.
 */
export function sharpness({ data, width, height }: { data: Uint8ClampedArray; width: number; height: number }): number {
  if (width < 3 || height < 3) return 0;

  const lum = new Float32Array(width * height);
  for (let i = 0, p = 0; i < lum.length; i++, p += 4) {
    lum[i] = 0.299 * data[p]! + 0.587 * data[p + 1]! + 0.114 * data[p + 2]!;
  }

  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const lap = lum[i - width]! + lum[i + width]! + lum[i - 1]! + lum[i + 1]! - 4 * lum[i]!;
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
}
