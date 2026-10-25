import { fitsPart, isPackId, STUDIO_OPTIONS, type PackId } from "@retrofit/core";
import { z } from "zod";
import catalogFile from "./products.json";

/**
 * Swappable options shown in the studio.
 * - "sample": an example product image from our render tests. No price, no store, clearly labelled.
 * - "colour": a finish described in words (paint, tint, wall colour). No product image needed.
 * - "catalog": a real product from a store (price + buy link), from products.json.
 * - "live": a real product found by a store search (lib/server/shop). Its store link is
 *   looked up on the server when someone taps Buy, so the browser never holds it.
 */
export type Product = {
  id: string;
  pack: PackId;
  part: string;
  title: string;
  kind: "sample" | "colour" | "catalog" | "live";
  /** Public path or URL of a product photo on a plain background. */
  image?: string;
  /** Hex colour for colour options. */
  swatch?: string;
  priceCents?: number;
  store?: string;
  buyUrl?: string;
  /** A store paid to be shown. Always labelled. */
  sponsored?: boolean;
};

/** A product from products.json. */
export type CatalogProduct = Product & { kind: "catalog"; priceCents: number; store: string; buyUrl: string };

/** A real product ready to buy: what the cart and the shop links need. */
export type BuyableProduct = Product & { kind: "catalog" | "live"; priceCents: number; store: string };

export const isBuyable = (p: Product | undefined): p is BuyableProduct =>
  typeof p?.priceCents === "number" &&
  Boolean(p.store) &&
  ((p.kind === "catalog" && Boolean(p.buyUrl)) || p.kind === "live");

const https = z.url({ protocol: /^https$/ });

/**
 * One real product in products.json. Copy the title, price and link from the store page
 * exactly; never guess them. `image` is the product photo on a plain background.
 */
const CatalogItemSchema = z.object({
  // "live-" is kept for products found by store search.
  id: z
    .string()
    .regex(/^[a-z0-9-]{3,120}$/)
    .refine((id) => !id.startsWith("live-"), "ids starting with live- are reserved"),
  pack: z.string().refine(isPackId, "unknown pack"),
  part: z.string().min(1).max(60),
  title: z.string().min(3).max(120),
  priceCents: z.number().int().positive().max(10_000_000),
  store: z.string().min(2).max(60),
  buyUrl: https,
  image: https,
  sponsored: z.boolean().optional(),
});

/** Checks products.json. A bad entry stops the app with a clear message rather than showing wrong data. */
export function loadCatalog(raw: unknown): CatalogProduct[] {
  const parsed = z.array(CatalogItemSchema).safeParse(raw);
  if (!parsed.success) throw new Error(`products.json is invalid: ${z.prettifyError(parsed.error)}`);
  const ids = new Set<string>();
  return parsed.data.map((item) => {
    if (ids.has(item.id)) throw new Error(`products.json has "${item.id}" twice`);
    ids.add(item.id);
    return { ...item, pack: item.pack as PackId, kind: "catalog" as const };
  });
}

// The samples and colours are shared with the iOS app (@retrofit/core); the catalog is web-only.
export const PRODUCTS: readonly Product[] = [...loadCatalog(catalogFile), ...STUDIO_OPTIONS];

export { fitsPart };

export function productsFor(pack: PackId, part: string): Product[] {
  return PRODUCTS.filter((p) => fitsPart(p, pack, part));
}

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
