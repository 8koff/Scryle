import { isPackId, type PackId } from "@retrofit/core";
import { postJson } from "./api";
import { claimOf, type Build } from "./builds";

/** Clothing searches: whose clothes to look for (same values as the web). */
export const FITS = ["women", "men", "any"] as const;
export type Fit = (typeof FITS)[number];

/** A real product a store search found. The store link stays on the server (/go/<id>). */
export type LiveProduct = {
  id: string;
  pack: PackId;
  part: string;
  title: string;
  priceCents: number;
  store: string;
  image: string;
};

const LIVE_ID = /^live-[a-f0-9]{20}$/;
const MAX_PRICE_CENTS = 10_000_000;

/**
 * Checks one product from the network before showing it. The server already checked it; this
 * only guards the screen (https pictures, sane text and price).
 */
export function parseLiveProduct(raw: unknown): LiveProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  const isText = (v: unknown, max: number): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
  if (typeof p.id !== "string" || !LIVE_ID.test(p.id)) return null;
  if (typeof p.pack !== "string" || !isPackId(p.pack)) return null;
  if (!isText(p.part, 60) || !isText(p.title, 200) || !isText(p.store, 80)) return null;
  if (typeof p.priceCents !== "number" || !Number.isInteger(p.priceCents) || p.priceCents <= 0 || p.priceCents > MAX_PRICE_CENTS) return null;
  if (typeof p.image !== "string" || !p.image.startsWith("https://")) return null;
  return { id: p.id, pack: p.pack, part: p.part, title: p.title, priceCents: p.priceCents, store: p.store, image: p.image };
}

export type SearchResult = { status: "ready"; products: LiveProduct[] } | { status: "error"; message: string };

/** Searches already made, so going back to a part doesn't spend another search. */
const found = new Map<string, LiveProduct[]>();
const inflight = new Map<string, Promise<SearchResult>>();
const MAX_KEPT = 60;

const keyOf = (build: Build, partId: string, fit: Fit | undefined) => `${build.id}|${partId}|${fit ?? ""}`;

export function cachedSearch(build: Build, partId: string, fit: Fit | undefined): LiveProduct[] | undefined {
  return found.get(keyOf(build, partId, fit));
}

/**
 * Real products for one part of the photo. Each new search uses one of the day's store
 * searches, so the studio only searches the part the person is looking at.
 */
export function searchStore(build: Build, partId: string, fit: Fit | undefined): Promise<SearchResult> {
  const key = keyOf(build, partId, fit);
  const kept = found.get(key);
  if (kept) return Promise.resolve({ status: "ready", products: kept });
  const running = inflight.get(key);
  if (running) return running;

  const request = postJson<{ products: unknown[] }>("/api/shop/search", {
    ...claimOf(build),
    partId,
    ...(fit ? { fit } : {}),
  })
    .then((result): SearchResult => {
      if (result.status === "error") return result;
      const raw = Array.isArray(result.data?.products) ? result.data.products : [];
      const products = raw.map(parseLiveProduct).filter((p): p is LiveProduct => p !== null);
      found.set(key, products);
      if (found.size > MAX_KEPT) found.delete(found.keys().next().value!);
      return { status: "ready", products };
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}
