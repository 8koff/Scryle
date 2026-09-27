"use client";

import { useState, type FormEvent } from "react";
import type { StudioPart } from "@/lib/build/parts";
import type { Build } from "@/lib/build/store";
import type { Product } from "@/lib/catalog/catalog";
import { cleanDescription, cleanSearchWords } from "@/lib/catalog/describe";
import type { Fit } from "@/lib/shop/live";
import { partForQuery } from "@/lib/shop/terms";
import { ProductRow, useStoreSearch } from "./store-results";

interface ShopSearchProps {
  build: Build;
  /** Parts that can take a store product. */
  shoppable: StudioPart[];
  /** Every part, for described swaps (paint, tint and wall colour too). */
  parts: StudioPart[];
  fit: Fit | undefined;
  selectedId: (partId: string) => string | undefined;
  onPick: (partId: string, product: Product, words: string) => void;
  onDescribe: (partId: string, text: string) => void;
}

/**
 * Search stores for anything. The search goes on the part of the photo it names ("walnut
 * coffee table" → the table); if it names none, the shopper picks the part.
 */
export function ShopSearch({ build, shoppable, parts, fit, selectedId, onPick, onDescribe }: ShopSearchProps) {
  const [draft, setDraft] = useState("");
  const [search, setSearch] = useState<{ words: string; partId: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canDescribe = build.pack !== "clothing";

  const partId = search?.partId ?? null;
  const result = useStoreSearch(build, { partId: partId ?? "", words: search?.words ?? "", fit }, Boolean(search && partId));

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const cleaned = cleanSearchWords(draft, build.pack);
    if (!cleaned.ok) return setError(cleaned.reason);
    setError(null);
    setSearch({ words: cleaned.text, partId: partForQuery(build.pack, shoppable, cleaned.text) });
  };

  const handleDescribe = () => {
    const target = partForQuery(build.pack, parts, draft);
    if (!target) return setError("Say which part it's for, e.g. “matte black wheels”.");
    const described = cleanDescription(draft, build.pack);
    if (!described.ok) return setError(described.reason);
    setError(null);
    onDescribe(target, described.text);
    setDraft("");
  };

  return (
    <section aria-label="Search stores">
      <form onSubmit={handleSearch} className="flex gap-2">
        <label className="sr-only" htmlFor="shop-search">
          Search stores for anything
        </label>
        <input
          id="shop-search"
          type="search"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={80}
          placeholder={canDescribe ? "Search any item, e.g. “walnut coffee table”" : "Search any item, e.g. “denim jacket”"}
          className="h-11 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-[15px] outline-none focus:border-accent"
        />
        <button type="submit" className="h-11 rounded-full bg-fg px-4 text-[15px] font-semibold text-bg active:scale-[0.97]">
          Search
        </button>
        {canDescribe && (
          <button
            type="button"
            onClick={handleDescribe}
            title="Swap in your own words, without a product"
            className="h-11 rounded-full bg-surface-2 px-4 text-[15px] font-semibold text-fg hover:bg-line active:scale-[0.97]"
          >
            Use words
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-accent-ink">
          {error}
        </p>
      )}

      {search && (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate text-[14px] font-semibold">“{search.words}”</p>
            <button type="button" onClick={() => setSearch(null)} className="shrink-0 text-[14px] font-medium text-muted hover:text-fg">
              Close
            </button>
          </div>
          <div role="group" aria-label="Which part it goes on" className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[13px] text-muted">{partId ? "Goes on" : "Which part is it for?"}</span>
            {shoppable.map((part) => (
              <button
                key={part.id}
                type="button"
                aria-pressed={partId === part.id}
                onClick={() => setSearch({ ...search, partId: part.id })}
                className={`h-8 rounded-full px-3 text-[13px] font-semibold transition-colors ${
                  partId === part.id ? "bg-fg text-bg" : "bg-surface-2 text-fg hover:bg-line"
                }`}
              >
                {part.label}
              </button>
            ))}
          </div>
          {partId && (
            <ProductRow result={result} selectedId={selectedId(partId)} onPick={(product) => onPick(partId, product, search.words)} />
          )}
        </div>
      )}
    </section>
  );
}
