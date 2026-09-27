import type { DetectedPart } from "./schema";

/**
 * Finds the part under a tap. Coordinates are photo-relative (0..1).
 * When boxes overlap, the smallest one wins: a tap on a wheel means the wheel,
 * not the whole car body behind it.
 */
export function partAtPoint(parts: readonly DetectedPart[], x: number, y: number): DetectedPart | undefined {
  let best: DetectedPart | undefined;
  for (const part of parts) {
    const { box } = part;
    const inside = x >= box.x && x <= box.x + box.w && y >= box.y && y <= box.y + box.h;
    if (!inside) continue;
    if (!best || box.w * box.h < best.box.w * best.box.h) best = part;
  }
  return best;
}
