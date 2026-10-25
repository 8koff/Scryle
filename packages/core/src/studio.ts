/**
 * What the studio offers for a photo, shared by the web and the iOS app: the parts to change,
 * and the built-in options (colours and example products) for each part. Real store products
 * come from the API's store search, not from here.
 */
import type { Pack, PackId } from "./packs/types";
import type { Box, SceneAnalysis } from "./scene/schema";

export type StudioPart = { id: string; label: string; boxes: Box[] };

/**
 * The parts the studio offers: everything the photo reader found (one entry per part, all its
 * boxes), then colour-only parts (paint, tint, wall colour) even if they weren't boxed.
 */
export function studioParts(pack: Pack, scene: SceneAnalysis): StudioPart[] {
  const byId = new Map<string, StudioPart>();
  for (const detected of scene.parts) {
    const existing = byId.get(detected.partId);
    if (existing) {
      existing.boxes.push(detected.box);
      continue;
    }
    const def = pack.parts.find((p) => p.id === detected.partId);
    byId.set(detected.partId, { id: detected.partId, label: def?.label ?? detected.label, boxes: [detected.box] });
  }
  for (const def of pack.parts) {
    if (def.textOnly && !byId.has(def.id)) byId.set(def.id, { id: def.id, label: def.label, boxes: [] });
  }
  return [...byId.values()];
}

/**
 * A built-in option.
 * - "sample": an example product image from our render tests. No price, no store, clearly labelled.
 * - "colour": a finish described in words (paint, tint, wall colour). No product image needed.
 */
export type StudioOption = {
  id: string;
  pack: PackId;
  part: string;
  title: string;
  kind: "sample" | "colour";
  /** Site path of the product photo (served by the web app, e.g. "/demo/product-jacket.jpg"). */
  image?: string;
  /** Hex colour for colour options. */
  swatch?: string;
};

const sample = (id: string, pack: PackId, part: string, title: string, image: string): StudioOption => ({
  id,
  pack,
  part,
  title,
  kind: "sample",
  image,
});

const colour = (pack: PackId, part: string, title: string, swatch: string): StudioOption => ({
  id: `${pack}-${part}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
  pack,
  part,
  title,
  kind: "colour",
  swatch,
});

export const STUDIO_OPTIONS: readonly StudioOption[] = [
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

/** True when a product for `product.part` may be put on this part of the photo. */
export function fitsPart(product: { pack: PackId; part: string }, pack: PackId, part: string): boolean {
  if (product.pack !== pack) return false;
  const accepted = RELATED[pack]?.[part] ?? [part];
  return accepted.includes(product.part);
}
