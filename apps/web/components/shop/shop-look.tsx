"use client";

import { formatUsd } from "@retrofit/core";
import { useState } from "react";
import type { SelectionInput } from "@/lib/build/store";
import { isBuyable, type BuyableProduct } from "@/lib/catalog/catalog";
import { shopLink } from "@/lib/shop/cart";
import { lookupProduct } from "@/lib/shop/seen";
import { useLiveProducts } from "@/lib/shop/use-live-products";
import { cart } from "@/lib/shop/use-cart";

/** The real products in a set of swaps. Samples, colours and described swaps aren't for sale. */
export function buyableIn(selections: readonly SelectionInput[]): BuyableProduct[] {
  return selections.flatMap((s) => {
    const product = "productId" in s ? lookupProduct(s.productId) : undefined;
    return isBuyable(product) ? [product] : [];
  });
}

/** Under a finished render: what's in it, where to buy it, and one tap to put it all in the cart. */
export function ShopLook({ selections }: { selections: readonly SelectionInput[] }) {
  // Re-reads the products once any found on another device have loaded.
  useLiveProducts(selections);
  const products = buyableIn(selections);
  const [added, setAdded] = useState(false);
  if (!products.length) return null;
  const total = products.reduce((sum, p) => sum + p.priceCents, 0);

  return (
    <section aria-labelledby="shop-look" className="rounded-[24px] border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between">
        <h2 id="shop-look" className="text-[16px] font-semibold">
          Shop this look
        </h2>
        <span className="text-[14px] font-semibold tabular-nums">{formatUsd(total)}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {products.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span className="size-12 shrink-0 overflow-hidden rounded-lg bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element -- a store's product photo */}
              <img src={p.image} alt="" className="size-full object-contain p-1" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium">{p.title}</p>
              <a href={shopLink(p.id)} target="_blank" rel="sponsored noopener" className="text-[13px] text-accent-ink underline-offset-4 hover:underline">
                {p.store} ↗
              </a>
            </div>
            <span className="text-[14px] tabular-nums">{formatUsd(p.priceCents)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => {
          cart.add(products);
          setAdded(true);
        }}
        className="mt-2 h-11 w-full rounded-full bg-accent text-[15px] font-semibold text-on-accent transition-transform active:scale-[0.98]"
      >
        {added ? "Added to cart" : products.length === 1 ? "Add to cart" : `Add all ${products.length} to cart`}
      </button>
      <p className="mt-2 text-center text-[12px] text-muted">We may earn a commission. Prices can change at the store.</p>
    </section>
  );
}
