import { isPackId, type PackId } from "@retrofit/core";
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

const sample = (id: string, pack: PackId, part: string, title: string, image: string): Product => ({
  id,
  pack,
  part,
  title,
  kind: "sample",
  image,
});

const colour = (pack: PackId, part: string, title: string, swatch: string): Product => ({
  id: `${pack}-${part}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  pack,
  part,
  title,
  kind: "colour",
  swatch,
});

export const PRODUCTS: readonly Product[] = [
  ...loadCatalog(catalogFile),
  sample("sample-bomber", "clothing", "outerwear", "Black leather bomber jacket", "/demo/product-jacket.jpg"),
  sample("sample-cargo", "clothing", "bottoms", "Olive cargo pants", "/demo/product-cargo.jpg"),
  sample("sample-runners", "clothing", "shoes", "White and green retro running sneakers", "/demo/product-sneakers.jpg"),
  sample("sample-wheels", "car", "wheels", "Gloss black 10-spoke alloy wheels", "/demo/product-wheel.jpg"),
  sample("sample-sofa", "room", "sofa", "Emerald green velvet sofa with brass legs", "/demo/product-sofa.jpg"),

  colour("car", "paint", "Gloss black paint", "#101112"),
  colour("car", "paint", "Satin grey paint", "#7b7f82"),
  colour("car", "paint", "Pearl white paint", "#eeece6"),
  colour("car", "paint", "Midnight blue metallic paint", "#1c2a4a"),
  colour("car", "paint", "Racing red paint", "#b3171b"),
  colour("car", "paint", "Deep green metallic paint", "#1f3d2b"),
  colour("car", "tint", "Light window tint (50%)", "#5b6168"),
  colour("car", "tint", "Medium window tint (35%)", "#3c4046"),
  colour("car", "tint", "Dark window tint (20%)", "#23262a"),
  colour("car", "tint", "Limo window tint (5%)", "#0d0e10"),

  colour("room", "wall-colour", "Warm white matte paint", "#f1ece2"),
  colour("room", "wall-colour", "Sage green matte paint", "#a7b39a"),
  colour("room", "wall-colour", "Terracotta matte paint", "#b8674a"),
  colour("room", "wall-colour", "Deep navy matte paint", "#23304a"),
  colour("room", "wall-colour", "Soft black matte paint", "#2b2a28"),
  colour("room", "wall-colour", "Blush pink matte paint", "#e3c2bb"),
];

/** Parts that can stand in for each other: a jacket can replace a hoodie, and the reverse. */
const RELATED: Partial<Record<PackId, Record<string, string[]>>> = {
  clothing: { top: ["top", "outerwear"], outerwear: ["outerwear", "top"] },
};

/** True when this product may be put on this part of the photo. */
export function fitsPart(product: Product, pack: PackId, part: string): boolean {
  if (product.pack !== pack) return false;
  const accepted = RELATED[pack]?.[part] ?? [part];
  return accepted.includes(product.part);
}

export function productsFor(pack: PackId, part: string): Product[] {
  return PRODUCTS.filter((p) => fitsPart(p, pack, part));
}

export function findProduct(id: string): Product | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
