"use client";

import { useEffect, useState } from "react";
import type { ApiResponse } from "@/lib/api";
import type { Build } from "@/lib/build/store";
import type { Product } from "@/lib/catalog/catalog";
import { parseLiveProduct, type Fit, type LiveProduct } from "@/lib/shop/live";
import { ProductCard, ProductCardSkeleton } from "./product-card";

export type StoreSearch = { partId: string; words: string; fit: Fit | undefined };
export type StoreResult =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; products: LiveProduct[] }
  | { status: "error"; message: string };

type Found = Extract<StoreResult, { status: "done" }>;
type Failed = Extract<StoreResult, { status: "error" }>;

/** Searches already made on this page, so switching parts back and forth doesn't ask again. */
const found = new Map<string, Found>();
const MAX_KEPT = 60;
/** Searches on their way, so two rows showing the same search (or React's dev double run) share one request. */
const inflight = new Map<string, Promise<Found | Failed>>();

const keyOf = (buildId: string, s: StoreSearch) => `${buildId}|${s.partId}|${s.fit ?? ""}|${s.words.toLowerCase()}`;

async function runSearch(build: Build, search: StoreSearch): Promise<Found | Failed> {
  try {
    const response = await fetch("/api/shop/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        claim: { photoUrl: build.photoUrl, pack: build.pack, width: build.width, height: build.height, scene: build.scene },
        token: build.token,
        partId: search.partId,
        ...(search.words ? { words: search.words } : {}),
        ...(search.fit ? { fit: search.fit } : {}),
      }),
    });
    const body = (await response.json()) as ApiResponse<{ products: unknown[] }>;
    if (!body.success) return { status: "error", message: body.error };
    return { status: "done", products: body.data.products.map(parseLiveProduct).filter((p): p is LiveProduct => p !== null) };
  } catch {
    return { status: "error", message: "No connection. Check your internet and try again." };
  }
}

/** Real products from stores for one part. Nothing is asked until `enabled` is true. */
export function useStoreSearch(build: Build, search: StoreSearch, enabled: boolean): StoreResult {
  const key = keyOf(build.id, search);
  const [, setVersion] = useState(0);
  // Errors aren't kept in `found`, so the next visit to this part tries again.
  const [error, setError] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!enabled || found.has(key)) return;
    let stopped = false;
    let request = inflight.get(key);
    if (!request) {
      request = runSearch(build, search).finally(() => inflight.delete(key));
      inflight.set(key, request);
    }
    void request.then((result) => {
      if (result.status === "done") {
        found.set(key, result);
        // Oldest first: a Map keeps insertion order.
        if (found.size > MAX_KEPT) found.delete(found.keys().next().value!);
      }
      if (stopped) return;
      setError(result.status === "error" ? { key, message: result.message } : null);
      setVersion((v) => v + 1);
    });
    return () => {
      stopped = true;
    };
    // The key covers everything the search depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);

  if (!enabled) return { status: "idle" };
  const done = found.get(key);
  if (done) return done;
  return error?.key === key ? { status: "error", message: error.message } : { status: "loading" };
}

interface ProductRowProps {
  result: StoreResult;
  selectedId: string | undefined;
  onPick: (product: Product) => void;
}

/** A sideways row of found products, with loading cards, a message, or nothing. */
export function ProductRow({ result, selectedId, onPick }: ProductRowProps) {
  if (result.status === "idle") return null;
  if (result.status === "error") {
    return (
      <p role="alert" className="mt-2 text-[14px] text-muted">
        {result.message}
      </p>
    );
  }
  if (result.status === "done" && !result.products.length) {
    return <p className="mt-2 text-[14px] text-muted">No store results. Try other words.</p>;
  }
  return (
    <div aria-busy={result.status === "loading"} className="-mx-4 mt-2 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
      {result.status === "loading"
        ? Array.from({ length: 4 }, (_, i) => <ProductCardSkeleton key={i} />)
        : result.products.map((product) => (
            <ProductCard key={product.id} product={product} isSelected={selectedId === product.id} onPick={() => onPick(product)} />
          ))}
    </div>
  );
}
