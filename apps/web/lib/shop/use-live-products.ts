"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/api";
import type { SelectionInput } from "@/lib/build/store";
import { isLiveId, parseLiveProduct, type LiveProduct } from "./live";
import { lookupProduct, seenProducts } from "./seen";

/** Found products named in these swaps that this browser hasn't seen yet. */
export const unknownLiveIds = (selections: readonly SelectionInput[] | undefined): string[] => [
  ...new Set(
    (selections ?? []).flatMap((s) => ("productId" in s && isLiveId(s.productId) && !lookupProduct(s.productId) ? [s.productId] : [])),
  ),
];

/**
 * Loads found products that came from elsewhere (a shared link, a render reopened on another
 * device) and remembers them. True once everything named is known, or couldn't be loaded.
 */
export function useLiveProducts(selections: readonly SelectionInput[] | undefined): boolean {
  const missing = unknownLiveIds(selections).join(",");
  const [doneFor, setDoneFor] = useState<string | null>(null);

  useEffect(() => {
    if (!missing) return;
    let stopped = false;
    fetch(`/api/shop/products?ids=${encodeURIComponent(missing)}`)
      .then((r) => r.json() as Promise<ApiResponse<unknown[]>>)
      .then((body) => {
        if (!body.success) return;
        seenProducts.remember(body.data.map(parseLiveProduct).filter((p): p is LiveProduct => p !== null));
      })
      .catch(() => {
        // Offline: the swaps without a product are skipped, the rest still work.
      })
      .finally(() => {
        if (!stopped) setDoneFor(missing);
      });
    return () => {
      stopped = true;
    };
  }, [missing]);

  return !missing || doneFor === missing;
}
