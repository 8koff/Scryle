import type { SelectionInput } from "@/lib/build/store";
import { findProduct, type Product } from "@/lib/catalog/catalog";
import { isLiveId } from "@/lib/shop/live";

export type FindLive = (ids: string[]) => Promise<Product[]>;

/**
 * A product lookup for a set of swaps: catalog products, plus the store-search products they
 * name, fetched in one go.
 */
export async function lookupProducts(selections: readonly SelectionInput[], findLive?: FindLive): Promise<(id: string) => Product | undefined> {
  const ids = [...new Set(selections.flatMap((s) => ("productId" in s && isLiveId(s.productId) ? [s.productId] : [])))];
  const found = ids.length && findLive ? await findLive(ids) : [];
  return (id) => findProduct(id) ?? found.find((p) => p.id === id);
}
