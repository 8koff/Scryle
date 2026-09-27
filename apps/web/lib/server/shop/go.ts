import type { ShopStore, StoredProduct } from "./products";
import { errorText, SerpApiError, type SerpApi, type StoreOffer } from "./serpapi";

export type ResolveDeps = {
  store: ShopStore;
  api: SerpApi | null;
  /** Takes one search from today's budget; false when it's used up. */
  takeSearch: () => Promise<boolean>;
};

type StoreLink = { url: string; isStore: boolean };

/** Store link lookups on their way, by product id. */
const pending = new Map<string, Promise<StoreLink>>();

const simple = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** The offer from the store the search showed, else the first store listed. */
export function pickOffer(offers: StoreOffer[], storeName: string): StoreOffer | undefined {
  const wanted = simple(storeName);
  return offers.find((o) => simple(o.name) === wanted) ?? offers[0];
}

/**
 * Where "Buy" goes for a found product: the store's own page. It's looked up once, the first
 * time anyone taps Buy (it uses one search), then kept. If Google has no store list for it,
 * Google's product page is kept instead (it still lists every store), so no search is spent twice.
 */
export async function resolveStoreLink(product: StoredProduct, deps: ResolveDeps): Promise<StoreLink> {
  if (product.storeUrl) return { url: product.storeUrl, isStore: product.storeUrl !== product.googleLink };
  // Two taps on Buy at once share one lookup.
  let job = pending.get(product.id);
  if (!job) {
    job = lookUpStore(product, deps).finally(() => pending.delete(product.id));
    pending.set(product.id, job);
  }
  return job;
}

async function lookUpStore(product: StoredProduct, deps: ResolveDeps): Promise<StoreLink> {
  const fallback = { url: product.googleLink, isStore: false };
  if (!deps.api || !product.offerToken || !(await deps.takeSearch())) return fallback;

  const keep = (url: string) =>
    deps.store.setStoreUrl(product.id, url).catch((error: unknown) => console.error("[shop] store link save failed", product.id, errorText(error)));

  try {
    const offer = pickOffer(await deps.api.offers(product.offerToken), product.store);
    await keep(offer?.link ?? product.googleLink);
    return offer ? { url: offer.link, isStore: true } : fallback;
  } catch (error) {
    console.error("[shop] offer lookup failed", product.id, errorText(error));
    // SerpApi answered "no results": that won't change, so remember it. A network error might, so don't.
    if (error instanceof SerpApiError) await keep(product.googleLink);
    return fallback;
  }
}
