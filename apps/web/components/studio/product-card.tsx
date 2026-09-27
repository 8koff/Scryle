"use client";

import Image from "next/image";
import { formatUsd } from "@retrofit/core";
import { isBuyable, type Product } from "@/lib/catalog/catalog";

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onPick: () => void;
}

/** One option in the studio: a product photo or a colour swatch, its name, and a price when it's for sale. */
export function ProductCard({ product, isSelected, onPick }: ProductCardProps) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={isSelected}
      className={`group flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl border bg-surface text-left transition-[border-color,transform] duration-150 active:scale-[0.98] ${
        isSelected ? "border-accent ring-2 ring-accent/30" : "border-line hover:border-muted"
      }`}
    >
      <div className="relative aspect-square bg-white">
        {product.image ? (
          <Image src={product.image} alt="" fill sizes="144px" unoptimized={product.image.startsWith("https://")} className="object-contain p-2" />
        ) : (
          <span className="absolute inset-3 rounded-full" style={{ backgroundColor: product.swatch }} />
        )}
        {(product.kind === "sample" || product.sponsored) && (
          <span className="absolute left-2 top-2 rounded-full bg-fg/80 px-2 py-0.5 text-[10px] font-semibold text-bg">
            {product.kind === "sample" ? "Sample" : "Sponsored"}
          </span>
        )}
      </div>
      <p className="line-clamp-2 px-2.5 pt-2 text-[13px] font-medium leading-snug">{product.title}</p>
      {isBuyable(product) ? (
        <p className="truncate px-2.5 pb-2 pt-0.5 text-[12px] text-muted">
          <span className="font-semibold text-fg">{formatUsd(product.priceCents)}</span> · {product.store}
        </p>
      ) : (
        <span className="pb-2" />
      )}
    </button>
  );
}

/** Placeholder cards while store results load. */
export function ProductCardSkeleton() {
  return (
    <div aria-hidden className="flex w-36 shrink-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="aspect-square animate-pulse bg-surface-2" />
      <div className="mx-2.5 mt-2.5 h-3 animate-pulse rounded bg-surface-2" />
      <div className="mx-2.5 mb-3 mt-2 h-3 w-16 animate-pulse rounded bg-surface-2" />
    </div>
  );
}
