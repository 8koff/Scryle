import { getPack, isPackId, type PackId } from "@retrofit/core";
import { z } from "zod";
import type { ApiResponse } from "@/lib/api";
import { isAllowedProduct } from "@/lib/catalog/describe";
import { FITS, type LiveProduct } from "@/lib/shop/live";
import { ClaimSchema } from "../render";
import { verifyPhoto } from "../signing";
import { toPublic, toStored, type ShopStore, type StoredProduct } from "./products";
import { buildSearchQuery, searchKey } from "./query";
import { errorText, type SerpApi } from "./serpapi";

/** A search is kept this long, so the same search twice costs one. */
export const SEARCH_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_RESULTS = 12;

/** New searches on their way, by key: a second request for the same search waits for the first instead of paying again. */
const pending = new Map<string, Promise<Result>>();

export type ShopSearchResult = { query: string; products: LiveProduct[] };

export type ShopSearchDeps = {
  secret: string;
  store: ShopStore;
  /** Null when SERPAPI_API_KEY isn't set. */
  api: SerpApi | null;
  /** Takes one search from today's budget; false when it's used up. */
  takeSearch: () => Promise<boolean>;
};

const RequestSchema = z.object({
  claim: ClaimSchema,
  token: z.string().min(1).max(200),
  partId: z.string().min(1).max(60),
  words: z.string().max(200).optional(),
  fit: z.enum(FITS).optional(),
});

type Result = { status: number; body: ApiResponse<ShopSearchResult> };
const fail = (status: number, error: string): Result => ({ status, body: { success: false, error } });
const ok = (query: string, products: StoredProduct[]): Result => ({
  status: 200,
  body: { success: true, data: { query, products: products.map(toPublic) } },
});

/**
 * Finds real products for one part of a scanned photo. The search words come from the signed
 * scan (plus the shopper's own checked words), so nobody can use our search budget for
 * anything else. Results are kept a day; a new search is only made within the daily budget.
 */
export async function handleShopSearch(input: unknown, deps: ShopSearchDeps): Promise<Result> {
  const parsed = RequestSchema.safeParse(input);
  if (!parsed.success) return fail(400, "That request didn't look right.");
  const { claim: raw, token, partId, words, fit } = parsed.data;
  if (!isPackId(raw.pack)) return fail(400, "Unknown category.");
  const claim = { ...raw, pack: raw.pack };
  if (!verifyPhoto(claim, token, deps.secret)) return fail(403, "This photo has expired. Please take a new one.");

  const pack = getPack(claim.pack);
  const def = pack.parts.find((p) => p.id === partId);
  const detected = claim.scene.parts.some((p) => p.partId === partId);
  if (def?.textOnly || (!def && !detected)) return fail(400, "There's nothing to shop for on that part.");

  const built = buildSearchQuery({ pack: pack.id, scene: claim.scene, partId, words, fit });
  if (!built.ok) return fail(400, built.reason);
  const key = searchKey(pack.id, partId, built.query);

  let cached: StoredProduct[] | null;
  try {
    cached = await deps.store.getSearch(key, SEARCH_TTL_MS);
  } catch (error) {
    // Without the saved searches we can't save new ones either, so don't spend a search.
    console.error("[shop] saved search read failed", { key }, errorText(error));
    return fail(502, "The store search didn't answer. Please try again.");
  }
  if (cached) return ok(built.query, cached);

  let job = pending.get(key);
  if (!job) {
    job = searchStores(key, built.query, pack.id, partId, deps).finally(() => pending.delete(key));
    pending.set(key, job);
  }
  return job;
}

/** A new store search: uses one from the budget, keeps only allowed products, saves them. */
async function searchStores(key: string, query: string, packId: PackId, partId: string, deps: ShopSearchDeps): Promise<Result> {
  if (!deps.api) return fail(503, "Shopping isn't set up yet.");
  if (!(await deps.takeSearch())) return fail(503, "Store search has hit today's limit. Please try again tomorrow.");

  let found: StoredProduct[];
  try {
    const hits = await deps.api.search(query);
    const seen = new Set<string>();
    found = hits
      .filter((h) => isAllowedProduct(h.title, packId))
      .map((h) => toStored(packId, partId, h))
      .filter((p) => !seen.has(p.id) && Boolean(seen.add(p.id)))
      .slice(0, MAX_RESULTS);
  } catch (error) {
    console.error("[shop] search failed", { key }, errorText(error));
    return fail(502, "The store search didn't answer. Please try again.");
  }
  try {
    // Renders, the cart and Buy links look products up by id, so unsaved results are no use.
    await deps.store.saveSearch(key, found);
  } catch (error) {
    console.error("[shop] save failed", { key }, errorText(error));
    return fail(502, "The store search didn't answer. Please try again.");
  }
  return ok(query, found);
}
