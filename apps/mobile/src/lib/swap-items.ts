import type { SelectionInput } from "@retrofit/core";
import type { LiveProduct } from "./store-search";

export type SwapItems = {
  /** Store products in the swap, in the order they were picked: these get a store link. */
  products: LiveProduct[];
  /** Everything else that changed, as saved: colours, built-in options, described swaps. */
  others: string[];
};

/**
 * Splits a saved swap into what can be bought and what can't. The server saves one label per
 * selection, in the same order (apps/web/lib/server/render.ts), so label i belongs to
 * selection i. A product that's no longer known stays listed by its label, without a link.
 */
export function swapItems(selections: readonly SelectionInput[], labels: readonly string[], loaded: readonly LiveProduct[]): SwapItems {
  const byId = new Map(loaded.map((p) => [p.id, p]));
  const products: LiveProduct[] = [];
  const others: string[] = [];
  const count = Math.max(selections.length, labels.length);
  for (let i = 0; i < count; i++) {
    const selection = selections[i];
    const label = labels[i];
    const product = selection && "productId" in selection ? byId.get(selection.productId) : undefined;
    if (product && !products.includes(product)) products.push(product);
    else if (label) others.push(label);
  }
  return { products, others };
}

/** The ids worth looking up: store products only (built-in options have no store). */
export const productIdsOf = (selections: readonly SelectionInput[]) =>
  selections.flatMap((s) => ("productId" in s ? [s.productId] : []));
