import { fitsPart, STUDIO_OPTIONS, type PackId, type SelectionInput, type StudioPart } from "@retrofit/core";
import type { LiveProduct } from "./store-search";

/** One swap picked in the studio, with what the screen needs to show it. */
export type Chosen = { input: SelectionInput; label: string; product?: LiveProduct };

/**
 * "Swap more": puts a saved swap's picks back on the parts of the photo. Built-in options come
 * from the shared list, store products from `live` (loaded by id). Words-only swaps are left
 * out: the app has no words box, and the person can pick again. One swap per part.
 */
export function preselectChoices(
  pack: PackId,
  parts: StudioPart[],
  selections: SelectionInput[],
  live: LiveProduct[],
): Record<string, Chosen> {
  const chosen: Record<string, Chosen> = {};
  for (const s of selections) {
    if (!("productId" in s)) continue;
    const option = STUDIO_OPTIONS.find((o) => o.id === s.productId);
    const product = live.find((p) => p.id === s.productId);
    const item = option ?? product;
    if (!item) continue;
    const part = parts.find((p) => p.id === s.partId && fitsPart(item, pack, p.id)) ?? parts.find((p) => fitsPart(item, pack, p.id));
    if (!part || chosen[part.id]) continue;
    chosen[part.id] = { input: { partId: part.id, productId: item.id }, label: item.title, ...(product ? { product } : {}) };
  }
  return chosen;
}
