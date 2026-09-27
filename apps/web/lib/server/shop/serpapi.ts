import { z } from "zod";
import { isTrustedImage } from "@/lib/shop/live";

/**
 * Thin client for SerpApi's Google Shopping search. Server-side only: it holds the API key.
 * Docs: https://serpapi.com/google-shopping-api and https://serpapi.com/google-immersive-product-api
 * Every uncached call uses one search from the monthly plan, so callers check the daily cap first.
 */

const BASE_URL = "https://serpapi.com/search.json";
const TIMEOUT_MS = 15_000;
const MAX_TOKEN = 4000;

/** One product from a shopping search. `googleLink` opens Google's product page. */
export type ShoppingHit = {
  title: string;
  priceCents: number;
  store: string;
  image: string;
  googleLink: string;
  /** Asks Google for this product's store offers (the real store link). */
  offerToken?: string;
};

/** One store selling a product, with its own link. */
export type StoreOffer = { name: string; link: string };

/** An error as one line for the logs. Never the error object: a request error could carry the URL, which holds the key. */
export const errorText = (error: unknown) =>
  (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).replace(/api_key=[^&\s]+/g, "api_key=***");

export class SerpApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SerpApiError";
  }
}

const isHttps = (raw: string, host?: RegExp) => {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && (!host || host.test(url.hostname));
  } catch {
    return false;
  }
};

const GOOGLE = /(^|\.)google\.com$/;

const HitSchema = z.object({
  title: z.string().trim().min(1).max(200),
  extracted_price: z.number().positive().max(100_000),
  source: z.string().trim().min(1).max(80),
  thumbnail: z.string().optional(),
  serpapi_thumbnail: z.string().optional(),
  product_link: z.string().refine((u) => isHttps(u, GOOGLE)),
  immersive_product_page_token: z.string().max(MAX_TOKEN).optional(),
});

/** A store's own site: a normal domain name, not an IP address, a local name or Google. */
const STORE_HOST = /^(?!\d+\.\d+\.\d+\.\d+$)(?!(.*\.)?google\.com$)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const OfferSchema = z.object({ name: z.string().trim().min(1).max(80), link: z.string().refine((u) => isHttps(u, STORE_HOST)) });

/** Turns one raw result into a hit, or null when anything we need is missing or odd. */
export function parseHit(raw: unknown): ShoppingHit | null {
  const parsed = HitSchema.safeParse(raw);
  if (!parsed.success) return null;
  const h = parsed.data;
  const image = [h.thumbnail, h.serpapi_thumbnail].find((u): u is string => Boolean(u && isTrustedImage(u)));
  if (!image) return null;
  return {
    title: h.title,
    priceCents: Math.round(h.extracted_price * 100),
    store: h.source,
    image,
    googleLink: h.product_link,
    ...(h.immersive_product_page_token ? { offerToken: h.immersive_product_page_token } : {}),
  };
}

export type SerpApiOptions = { apiKey: string; fetch?: typeof fetch };

export function createSerpApi({ apiKey, fetch: fetchImpl = fetch }: SerpApiOptions) {
  if (!apiKey.trim()) throw new Error("Missing SERPAPI_API_KEY");

  async function call(params: Record<string, string>): Promise<Record<string, unknown>> {
    const url = new URL(BASE_URL);
    for (const [k, v] of Object.entries({ ...params, api_key: apiKey.trim() })) url.searchParams.set(k, v);
    // Never log `url`: it holds the key.
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const body = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !body || typeof body.error === "string") {
      throw new SerpApiError(`SerpApi ${params.engine} failed (${response.status}): ${String(body?.error ?? "no body")}`);
    }
    return body;
  }

  return {
    /** US store results for a search, best first. Bad or incomplete results are left out. */
    async search(q: string): Promise<ShoppingHit[]> {
      const body = await call({ engine: "google_shopping", q, gl: "us", hl: "en" });
      const results = Array.isArray(body.shopping_results) ? body.shopping_results : [];
      return results.map(parseHit).filter((h): h is ShoppingHit => h !== null);
    },

    /** The stores that sell one product, each with its own https link. */
    async offers(token: string): Promise<StoreOffer[]> {
      const body = await call({ engine: "google_immersive_product", page_token: token });
      const product = body.product_results as { stores?: unknown } | undefined;
      const stores = Array.isArray(product?.stores) ? product.stores : [];
      return stores.flatMap((s) => {
        const parsed = OfferSchema.safeParse(s);
        return parsed.success ? [parsed.data] : [];
      });
    },
  };
}

export type SerpApi = ReturnType<typeof createSerpApi>;

export function serpApiFromEnv(env: Record<string, string | undefined> = process.env): SerpApi | null {
  const apiKey = env.SERPAPI_API_KEY?.trim();
  return apiKey ? createSerpApi({ apiKey }) : null;
}
