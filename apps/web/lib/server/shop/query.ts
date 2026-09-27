import type { PackId, SceneAnalysis } from "@retrofit/core";
import { cleanSearchWords } from "@/lib/catalog/describe";
import type { Fit } from "@/lib/shop/live";
import { BASE_TERMS } from "@/lib/shop/terms";

/** Car parts that depend on the car, so the make and model go in the search. */
const CAR_SPECIFIC = new Set(["wheels", "headlights", "spoiler"]);

export type SearchRequest = { pack: PackId; scene: SceneAnalysis; partId: string; words?: string; fit?: Fit };
export type BuiltQuery = { ok: true; query: string } | { ok: false; reason: string };

/** A scene fact made safe for a search box, or "" when it isn't. */
function fact(value: string | undefined, pack: PackId): string {
  if (!value) return "";
  const cleaned = cleanSearchWords(value.slice(0, 40), pack);
  return cleaned.ok ? cleaned.text : "";
}

/** "2019 Honda Civic", from what the photo reader guessed (the shopper confirmed or ignored it). */
function carName(scene: SceneAnalysis): string {
  const d = scene.details ?? {};
  return [d.year, d.make, d.model].map((v) => fact(v, "car")).filter(Boolean).join(" ");
}

/** The clothing fit to search for: the shopper's choice, else what the photo reader saw. */
function fitWord(scene: SceneAnalysis, fit: Fit | undefined): string {
  const chosen = fit ?? scene.details?.fit;
  return chosen === "men" ? "men's" : chosen === "women" ? "women's" : "";
}

/** The words for a part: its usual search term, or for "Anything" the name the photo reader gave it. */
function baseTerm(req: SearchRequest): string {
  const known = BASE_TERMS[req.pack]?.[req.partId];
  if (known) return known;
  const detected = req.scene.parts.find((p) => p.partId === req.partId);
  return fact(detected?.label, req.pack);
}

/**
 * Builds the store search for one part. Everything comes from the signed scan, except the
 * shopper's own words, which get the same checks as a described swap (and, for clothing,
 * no swimwear or underwear).
 */
export function buildSearchQuery(req: SearchRequest): BuiltQuery {
  const base = baseTerm(req);
  if (!base) return { ok: false, reason: "We can't search for that part." };

  let words = "";
  if (req.words?.trim()) {
    const cleaned = cleanSearchWords(req.words, req.pack);
    if (!cleaned.ok) return cleaned;
    words = cleaned.text;
  }

  const lastWord = base.split(" ").at(-1)!;
  const mentionsBase = words.toLowerCase().includes(lastWord.replace(/s$/, ""));
  const parts = [
    req.pack === "clothing" ? fitWord(req.scene, req.fit) : "",
    req.pack === "car" && CAR_SPECIFIC.has(req.partId) ? carName(req.scene) : "",
    words,
    mentionsBase ? "" : base,
  ];
  return { ok: true, query: parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim().slice(0, 120) };
}

/** Same search, same results: case and spacing don't matter. */
export const searchKey = (pack: PackId, partId: string, query: string) => `${pack}:${partId}:${query.toLowerCase()}`;
