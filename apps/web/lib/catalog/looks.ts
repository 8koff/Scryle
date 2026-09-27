import type { PackId } from "@retrofit/core";
import type { SelectionInput } from "@/lib/build/store";
import { PRODUCTS } from "./catalog";

/**
 * One tap, a whole look: a saved list of swaps. Only the parts found in the photo are used.
 * Words describe a style (like a typed swap), never a made-up product or price. Clothing
 * looks use catalog items only, the same rule as the studio.
 */
export type Look = { id: string; pack: PackId; name: string; selections: SelectionInput[] };

/** A colour option by its exact title, so a renamed colour fails the tests instead of vanishing. */
const colour = (pack: PackId, partId: string, title: string): SelectionInput => {
  const product = PRODUCTS.find((p) => p.pack === pack && p.part === partId && p.title === title);
  return { partId, productId: product?.id ?? `missing:${title}` };
};
const words = (partId: string, text: string): SelectionInput => ({ partId, text });
const item = (partId: string, productId: string): SelectionInput => ({ partId, productId });

export const LOOKS: readonly Look[] = [
  {
    id: "room-japandi",
    pack: "room",
    name: "Japandi",
    selections: [
      colour("room", "wall-colour", "Warm white matte paint"),
      words("sofa", "low light oak sofa with oatmeal linen cushions"),
      words("table", "round light oak coffee table"),
      words("rug", "flat woven natural jute rug"),
      words("lamp", "white paper lantern floor lamp"),
      words("chair", "light oak lounge chair with a cream cushion"),
    ],
  },
  {
    id: "room-mid-century",
    pack: "room",
    name: "Mid-century",
    selections: [
      colour("room", "wall-colour", "Sage green matte paint"),
      words("sofa", "walnut mid-century sofa with mustard wool cushions"),
      words("table", "oval walnut coffee table with tapered legs"),
      words("rug", "rust and cream geometric wool rug"),
      words("lamp", "brass arc floor lamp"),
      words("chair", "molded walnut plywood lounge chair"),
    ],
  },
  {
    id: "room-cozy",
    pack: "room",
    name: "Cozy",
    selections: [
      colour("room", "wall-colour", "Terracotta matte paint"),
      words("sofa", "deep cream boucle sofa with rounded arms"),
      words("rug", "thick cream shag rug"),
      words("lamp", "linen shade table lamp with a warm glow"),
      words("curtains", "heavy oatmeal linen curtains"),
      words("chair", "chunky cream knit armchair"),
    ],
  },
  {
    id: "car-jdm",
    pack: "car",
    name: "JDM",
    selections: [
      item("wheels", "sample-wheels"),
      colour("car", "tint", "Dark window tint (20%)"),
      words("suspension", "lowered 1.5 inches with flush wheel fitment"),
      words("calipers", "red brake calipers"),
      words("spoiler", "small carbon fiber trunk lip spoiler"),
    ],
  },
  {
    id: "car-stance",
    pack: "car",
    name: "Stance",
    selections: [
      words("wheels", "polished deep dish multi-piece wheels"),
      colour("car", "paint", "Satin grey paint"),
      colour("car", "tint", "Limo window tint (5%)"),
      words("suspension", "slammed on air suspension with tucked wheels"),
    ],
  },
  {
    id: "car-off-road",
    pack: "car",
    name: "Off-road",
    selections: [
      words("wheels", "matte black off-road wheels"),
      words("tires", "chunky all-terrain tires with raised white letters"),
      colour("car", "paint", "Deep green metallic paint"),
      words("suspension", "lifted 2 inches"),
      words("headlights", "round LED headlights"),
    ],
  },
  {
    id: "clothing-streetwear",
    pack: "clothing",
    name: "Streetwear",
    selections: [item("outerwear", "sample-bomber"), item("bottoms", "sample-cargo"), item("shoes", "sample-runners")],
  },
];

export const looksFor = (pack: PackId): Look[] => LOOKS.filter((l) => l.pack === pack);
