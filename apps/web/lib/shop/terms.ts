import type { PackId } from "@retrofit/core";

/** What to search for on each part when the shopper types nothing. */
export const BASE_TERMS: Partial<Record<PackId, Record<string, string>>> = {
  clothing: {
    top: "top",
    outerwear: "jacket",
    bottoms: "pants",
    shoes: "shoes",
    hat: "hat",
    bag: "bag",
    glasses: "sunglasses",
    jewellery: "necklace",
  },
  car: {
    wheels: "wheels",
    tires: "all season tires",
    headlights: "headlights",
    spoiler: "spoiler",
    exhaust: "exhaust tips",
    calipers: "brake caliper covers",
  },
  room: {
    sofa: "sofa",
    chair: "accent chair",
    table: "coffee table",
    rug: "area rug",
    lamp: "floor lamp",
    "light-fixture": "ceiling light fixture",
    curtains: "curtains",
    art: "wall art",
    bed: "bed frame",
    shelving: "bookshelf",
  },
};

/** Other words people use for each part, so a typed search lands on the right part of the photo. */
const OTHER_NAMES: Partial<Record<PackId, Record<string, string[]>>> = {
  clothing: {
    top: ["shirt", "tee", "t-shirt", "blouse", "sweater", "hoodie", "sweatshirt", "polo", "tank", "cardigan", "jumper"],
    outerwear: ["jacket", "coat", "blazer", "parka", "bomber", "puffer", "vest", "windbreaker", "trench"],
    bottoms: ["pants", "jeans", "trousers", "skirt", "shorts", "chinos", "cargo", "cargos", "joggers", "leggings"],
    shoes: ["shoes", "sneakers", "trainers", "boots", "loafers", "heels", "sandals", "runners"],
    hat: ["hat", "cap", "beanie", "bucket"],
    bag: ["bag", "backpack", "tote", "purse", "handbag"],
    glasses: ["glasses", "sunglasses", "shades", "eyewear"],
    jewellery: ["necklace", "chain", "bracelet", "earrings", "ring", "jewelry", "jewellery", "watch"],
  },
  car: {
    wheels: ["wheels", "rims", "wheel", "rim", "alloys"],
    tires: ["tires", "tyres", "tire", "tyre"],
    headlights: ["headlights", "headlight", "lights", "lamps"],
    spoiler: ["spoiler", "wing", "lip"],
    exhaust: ["exhaust", "tips", "muffler"],
    calipers: ["calipers", "caliper", "brakes"],
  },
  room: {
    sofa: ["sofa", "couch", "sectional", "loveseat", "settee"],
    chair: ["chair", "armchair", "recliner", "stool"],
    table: ["table", "desk"],
    rug: ["rug", "carpet", "runner"],
    lamp: ["lamp"],
    "light-fixture": ["chandelier", "pendant", "ceiling", "fixture", "sconce"],
    curtains: ["curtains", "drapes", "blinds", "curtain"],
    art: ["art", "print", "poster", "painting", "mirror", "frame"],
    bed: ["bed", "headboard", "mattress"],
    shelving: ["shelf", "shelves", "bookshelf", "bookcase", "shelving", "cabinet", "dresser", "storage"],
  },
};

type PartRef = { id: string; label: string };

const wordsOf = (text: string) => text.toLowerCase().split(/[^a-z0-9-]+/).filter(Boolean);
const singular = (word: string) => word.replace(/(es|s)$/, "");

/** Every word that names this part: its id, its label, its search term and its other names. */
function namesFor(pack: PackId, part: PartRef): Set<string> {
  const names = [part.id, part.label, BASE_TERMS[pack]?.[part.id] ?? "", ...(OTHER_NAMES[pack]?.[part.id] ?? [])].flatMap(wordsOf);
  return new Set(names.map(singular));
}

/**
 * Which part of the photo a typed search is about: "walnut coffee table" → the table. The last
 * word decides first ("velvet sofa" is a sofa, not something velvet), then any word. Null when
 * nothing in the photo matches.
 */
export function partForQuery(pack: PackId, parts: readonly PartRef[], query: string): string | null {
  const words = wordsOf(query).map(singular);
  if (!words.length) return null;
  const named = parts.map((part) => ({ part, names: namesFor(pack, part) }));
  for (const word of [...words].reverse()) {
    const hit = named.find(({ names }) => names.has(word));
    if (hit) return hit.part.id;
  }
  return null;
}

/** Style words worth carrying from one part to the others: colours, wood and metal finishes, style names. */
const STYLE_WORDS = [
  "mid-century",
  "midcentury",
  "modern",
  "contemporary",
  "scandinavian",
  "japandi",
  "boho",
  "bohemian",
  "rustic",
  "farmhouse",
  "industrial",
  "minimalist",
  "vintage",
  "retro",
  "coastal",
  "traditional",
  "streetwear",
  "preppy",
  "classic",
  "sporty",
  "walnut",
  "oak",
  "teak",
  "rattan",
  "wicker",
  "marble",
  "brass",
  "gold",
  "chrome",
  "silver",
  "bronze",
  "matte",
  "gloss",
  "black",
  "white",
  "cream",
  "beige",
  "grey",
  "gray",
  "brown",
  "tan",
  "navy",
  "blue",
  "green",
  "olive",
  "sage",
  "red",
  "burgundy",
  "pink",
  "terracotta",
  "orange",
  "yellow",
  "mustard",
  "purple",
];
const STYLE_SET = new Set(STYLE_WORDS);
const MAX_STYLE_WORDS = 2;

/**
 * The style in something the shopper typed or picked: "Walnut Mid-Century Coffee Table" →
 * "walnut mid-century". Empty when there's no style word in it.
 */
export function styleWordsFrom(text: string): string {
  const found = wordsOf(text).filter((w) => STYLE_SET.has(w));
  return [...new Set(found)].slice(0, MAX_STYLE_WORDS).join(" ");
}
