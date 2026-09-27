import { createHash } from "node:crypto";
import type { PackId } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseLiveProduct, type LiveProduct } from "@/lib/shop/live";
import type { ShoppingHit } from "./serpapi";

/** A found product as the server keeps it: what the browser sees, plus how to reach the store. */
export type StoredProduct = LiveProduct & {
  googleLink: string;
  offerToken?: string;
  /** The store's own page, found the first time someone taps Buy. */
  storeUrl?: string;
};

/** The same product in the same category and part always gets the same id, so carts and renders keep working. */
export function liveProductId(pack: PackId, part: string, hit: Pick<ShoppingHit, "store" | "title">): string {
  const digest = createHash("sha256").update(`${pack}|${part}|${hit.store}|${hit.title}`).digest("hex");
  return `live-${digest.slice(0, 20)}`;
}

export function toStored(pack: PackId, part: string, hit: ShoppingHit): StoredProduct {
  return {
    id: liveProductId(pack, part, hit),
    pack,
    part,
    kind: "live",
    title: hit.title,
    priceCents: hit.priceCents,
    store: hit.store,
    image: hit.image,
    googleLink: hit.googleLink,
    ...(hit.offerToken ? { offerToken: hit.offerToken } : {}),
  };
}

/** Only what the browser may see: no links or tokens. */
export const toPublic = (p: StoredProduct): LiveProduct => ({
  id: p.id,
  pack: p.pack,
  part: p.part,
  kind: "live",
  title: p.title,
  priceCents: p.priceCents,
  store: p.store,
  image: p.image,
});

export type ShopStore = {
  /** A saved search younger than `maxAgeMs`, in result order, or null. */
  getSearch(key: string, maxAgeMs: number): Promise<StoredProduct[] | null>;
  /** Saves (or refreshes) the products, then the search that found them. */
  saveSearch(key: string, products: StoredProduct[]): Promise<void>;
  getMany(ids: string[]): Promise<StoredProduct[]>;
  setStoreUrl(id: string, url: string): Promise<void>;
};

type Row = {
  id: string;
  pack: string;
  part: string;
  title: string;
  price_cents: number;
  store: string;
  image: string;
  google_link: string;
  offer_token: string | null;
  store_url: string | null;
};

function fromRow(r: Row): StoredProduct | null {
  const product = parseLiveProduct({ id: r.id, pack: r.pack, part: r.part, title: r.title, priceCents: r.price_cents, store: r.store, image: r.image });
  if (!product) return null;
  return {
    ...product,
    googleLink: r.google_link,
    ...(r.offer_token ? { offerToken: r.offer_token } : {}),
    ...(r.store_url ? { storeUrl: r.store_url } : {}),
  };
}

const toRow = (p: StoredProduct) => ({
  id: p.id,
  pack: p.pack,
  part: p.part,
  title: p.title,
  price_cents: p.priceCents,
  store: p.store,
  image: p.image,
  google_link: p.googleLink,
  offer_token: p.offerToken ?? null,
  updated_at: new Date().toISOString(),
});

/** Puts products back in the order of `ids`, skipping any that are gone. */
const inOrder = (ids: string[], products: StoredProduct[]) => {
  const byId = new Map(products.map((p) => [p.id, p]));
  return ids.flatMap((id) => byId.get(id) ?? []);
};

export function createSupabaseShopStore(db: SupabaseClient): ShopStore {
  const store: ShopStore = {
    async getSearch(key, maxAgeMs) {
      const since = new Date(Date.now() - maxAgeMs).toISOString();
      const { data, error } = await db
        .from("shop_searches")
        .select("product_ids")
        .eq("key", key)
        .gte("created_at", since)
        .maybeSingle<{ product_ids: string[] }>();
      if (error) throw new Error(`[shop] search read failed: ${error.message}`);
      return data ? store.getMany(data.product_ids) : null;
    },
    async saveSearch(key, products) {
      if (products.length) {
        // A store link found earlier stays: it isn't in toRow, so the upsert leaves it alone.
        const { error } = await db.from("shop_products").upsert(products.map(toRow), { onConflict: "id" });
        if (error) throw new Error(`[shop] product save failed: ${error.message}`);
      }
      const { error } = await db
        .from("shop_searches")
        .upsert({ key, product_ids: products.map((p) => p.id), created_at: new Date().toISOString() }, { onConflict: "key" });
      if (error) throw new Error(`[shop] search save failed: ${error.message}`);
    },
    async getMany(ids) {
      if (!ids.length) return [];
      const { data, error } = await db.from("shop_products").select("*").in("id", ids).returns<Row[]>();
      if (error) throw new Error(`[shop] product read failed: ${error.message}`);
      return inOrder(ids, (data ?? []).map(fromRow).filter((p): p is StoredProduct => p !== null));
    },
    async setStoreUrl(id, url) {
      const { error } = await db.from("shop_products").update({ store_url: url }).eq("id", id);
      if (error) throw new Error(`[shop] store link save failed: ${error.message}`);
    },
  };
  return store;
}

/** Same rules, in memory (tests and local dev without Supabase). */
export function createMemoryShopStore(now: () => number = Date.now): ShopStore {
  const products = new Map<string, StoredProduct>();
  const searches = new Map<string, { ids: string[]; at: number }>();
  const store: ShopStore = {
    async getSearch(key, maxAgeMs) {
      const found = searches.get(key);
      return found && now() - found.at <= maxAgeMs ? store.getMany(found.ids) : null;
    },
    async saveSearch(key, list) {
      for (const p of list) {
        const storeUrl = products.get(p.id)?.storeUrl;
        products.set(p.id, { ...p, ...(storeUrl ? { storeUrl } : {}) });
      }
      searches.set(key, { ids: list.map((p) => p.id), at: now() });
    },
    getMany: async (ids) => inOrder(ids, [...products.values()]),
    async setStoreUrl(id, url) {
      const p = products.get(id);
      if (p) products.set(id, { ...p, storeUrl: url });
    },
  };
  return store;
}
