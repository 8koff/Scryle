"use client";

import type { StudioPart } from "@/lib/build/parts";
import type { Chosen } from "@/lib/build/remix";
import type { Build } from "@/lib/build/store";
import { productsFor, type Product } from "@/lib/catalog/catalog";
import type { Fit } from "@/lib/shop/live";
import { ProductCard } from "./product-card";
import { ProductRow, useStoreSearch } from "./store-results";

/** The row's element id, so the studio can scroll to it when a part is tapped on the photo. */
export const partRowId = (partId: string) => `row-${partId}`;

interface PartRowProps {
  build: Build;
  part: StudioPart;
  /** Paint, tint, wall colour: colours only, no store search. */
  isColourOnly: boolean;
  /** Search words for this row: the style of the shopper's picks, or what found this row's pick. */
  words: string;
  fit: Fit | undefined;
  /** Store products are loaded (shown at once for the first parts, or after "Show products"). */
  isOpen: boolean;
  isActive: boolean;
  chosen: Chosen | undefined;
  onOpen: (partId: string) => void;
  onPick: (partId: string, product: Product) => void;
  onClear: (partId: string) => void;
}

/**
 * One part of the photo and what could replace it: our samples and colours, then real store
 * products. The search uses `words` (the style of the other picks); if that search can't run
 * (today's budget is used up), the plain search for the part is shown instead.
 */
export function PartRow({ build, part, isColourOnly, words, fit, isOpen, isActive, chosen, onOpen, onPick, onClear }: PartRowProps) {
  const options = productsFor(build.pack, part.id);
  const selectedId = chosen?.input && "productId" in chosen.input ? chosen.input.productId : undefined;
  const canShop = !isColourOnly;
  const styled = useStoreSearch(build, { partId: part.id, words, fit }, canShop && isOpen && Boolean(words));
  const plain = useStoreSearch(build, { partId: part.id, words: "", fit }, canShop && isOpen && (!words || styled.status === "error"));
  const result = words && styled.status !== "error" ? styled : plain;

  return (
    <section
      id={partRowId(part.id)}
      aria-labelledby={`part-${part.id}`}
      className={`scroll-mt-20 rounded-[20px] border p-4 transition-colors ${isActive ? "border-accent/60 bg-surface" : "border-line"}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 id={`part-${part.id}`} className="text-[16px] font-semibold">
          {part.label}
          {chosen && <span className="ml-2 text-[13px] font-medium text-accent-ink">Picked</span>}
        </h3>
        {chosen && (
          <button type="button" onClick={() => onClear(part.id)} className="text-[14px] font-medium text-muted hover:text-fg">
            Keep original
          </button>
        )}
      </div>

      {options.length > 0 && (
        <div className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
          {options.map((product) => (
            <ProductCard key={product.id} product={product} isSelected={selectedId === product.id} onPick={() => onPick(part.id, product)} />
          ))}
        </div>
      )}

      {canShop &&
        (isOpen ? (
          <ProductRow result={result} selectedId={selectedId} onPick={(product) => onPick(part.id, product)} />
        ) : (
          <button
            type="button"
            onClick={() => onOpen(part.id)}
            aria-expanded={false}
            aria-controls={partRowId(part.id)}
            className="mt-2 h-10 rounded-full bg-surface-2 px-4 text-[14px] font-semibold text-fg transition-colors hover:bg-line"
          >
            Show products
          </button>
        ))}

      {chosen && !selectedId && <p className="mt-2 text-[13px] text-muted">Your words: {chosen.label}</p>}
    </section>
  );
}
