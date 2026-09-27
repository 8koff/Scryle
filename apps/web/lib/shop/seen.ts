import { findProduct, type Product } from "@/lib/catalog/catalog";
import { parseLiveProduct, type LiveProduct } from "./live";

const KEY = "retrofit:shop-seen";
/** Enough for every cart and render in a session; the oldest are dropped first. */
const MAX_SEEN = 200;

/**
 * Found products this browser has seen, so the cart, "Shop this look" and the studio can show
 * them without asking the server again. Prices are what the store showed when found.
 */
export function createSeenStore(storage: () => Storage | null) {
  let cacheRaw: string | null | undefined;
  let cache = new Map<string, LiveProduct>();

  const read = (): Map<string, LiveProduct> => {
    let raw: string | null = null;
    try {
      raw = storage()?.getItem(KEY) ?? null;
    } catch {
      raw = null;
    }
    if (raw === cacheRaw) return cache;
    let list: unknown = [];
    try {
      list = raw ? JSON.parse(raw) : [];
    } catch {
      list = [];
    }
    const products = (Array.isArray(list) ? list : []).map(parseLiveProduct).filter((p): p is LiveProduct => p !== null);
    cacheRaw = raw;
    cache = new Map(products.map((p) => [p.id, p]));
    return cache;
  };

  return {
    get: (id: string): LiveProduct | undefined => read().get(id),
    /** Keeps these products, newest first. A product seen again gets its new price. */
    remember(products: readonly LiveProduct[]) {
      if (!products.length) return;
      const fresh = new Set(products.map((p) => p.id));
      const next = [...products, ...[...read().values()].filter((p) => !fresh.has(p.id))].slice(0, MAX_SEEN);
      try {
        storage()?.setItem(KEY, JSON.stringify(next));
      } catch {
        // Storage full or blocked: products still work for this page, just not after a reload.
      }
    },
  };
}

export const seenProducts = createSeenStore(() => (typeof window === "undefined" ? null : window.localStorage));

/** Any product by id: our catalog first, then found products this browser has seen. */
export const lookupProduct = (id: string): Product | undefined => findProduct(id) ?? seenProducts.get(id);
