import type { PackId } from "@retrofit/core";
import { fitsPart } from "@/lib/catalog/catalog";
import { cleanDescription } from "@/lib/catalog/describe";
import { lookupProduct } from "@/lib/shop/seen";
import type { StudioPart } from "./parts";
import type { SelectionInput } from "./store";

/** One swap picked in the studio, with what the options panel needs to show it. */
export type Chosen = { input: SelectionInput; label: string; image?: string; swatch?: string };

/** "Try this on me": the swaps from a share link, waiting for the next scan in this tab. */
export type Remix = { pack: PackId; selections: SelectionInput[]; from: string };

const KEY = "retrofit:remix";

export function saveRemix(storage: Storage, remix: Remix): void {
  try {
    storage.setItem(KEY, JSON.stringify(remix));
  } catch {
    // Storage full or blocked: the scan still works, just without the picks.
  }
}

/** Reads and clears the waiting swaps, if they are for this category. */
export function takeRemix(storage: Storage, pack: PackId): SelectionInput[] | undefined {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return undefined;
    const remix = JSON.parse(raw) as Remix;
    if (remix.pack !== pack || !Array.isArray(remix.selections)) return undefined;
    storage.removeItem(KEY);
    return remix.selections.slice(0, 6);
  } catch {
    return undefined;
  }
}

/**
 * Puts shared swaps onto the parts found in a new photo. A jacket can land on a "top"
 * (related parts); anything that doesn't fit this photo is skipped. One swap per part.
 */
export function remixChoices(pack: PackId, parts: StudioPart[], selections: SelectionInput[]): Record<string, Chosen> {
  const chosen: Record<string, Chosen> = {};
  for (const s of selections) {
    if ("productId" in s) {
      const product = lookupProduct(s.productId);
      if (!product) continue;
      const part = parts.find((p) => p.id === s.partId && fitsPart(product, pack, p.id)) ?? parts.find((p) => fitsPart(product, pack, p.id));
      if (!part || chosen[part.id]) continue;
      chosen[part.id] = { input: { partId: part.id, productId: product.id }, label: product.title, image: product.image, swatch: product.swatch };
    } else {
      const part = parts.find((p) => p.id === s.partId);
      const described = cleanDescription(s.text, pack);
      if (!part || !described.ok || chosen[part.id]) continue;
      chosen[part.id] = { input: { partId: part.id, text: described.text }, label: described.text };
    }
  }
  return chosen;
}
