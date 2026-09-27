import type { PackId } from "@retrofit/core";

const MAX_LENGTH = 80;
const ALLOWED = /^[\p{L}\p{N} ,.'&%()\-/+]+$/u;
/** Words that try to steer the model rather than describe an item. */
const STEERING = /\b(ignore|instructions?|prompts?|system|previous|face|person|people|remove|delete)\b/i;
/** Content we never render. The image provider also filters, this just fails fast. */
const UNSAFE = /\b(nude|naked|nsfw|sex\w*|porn\w*|lingerie|bikini|underwear|gun|guns|rifle|weapon\w*|blood|gore|nazi|swastika|drug\w*)\b/i;

/** Clothing we never show or render: the "no swimwear or underwear" rule. */
const NOT_FOR_CLOTHING =
  /\b(swim\w*|bikinis?|tankinis?|bras?|bralettes?|briefs?|panty|panties|thongs?|boxers?|lingerie|underwear|undies|bodysuits?|leotards?|corsets?|garters?|negligees?|sleepwear|nightgowns?|sheer|see[- ]through|g-?strings?|bathing|monokinis?|trikinis?|cheekinis?|boy-?shorts?|rash ?guards?|beachwear|shapewear|pasties|nipples?|jockstraps?|speedos?|trunks)\b/i;

export type Described = { ok: true; text: string } | { ok: false; reason: string };

/** Store search words: the same checks as a described swap, allowed for clothing but with no swimwear or underwear. */
export function cleanSearchWords(raw: string, pack: PackId): Described {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "Type what you're looking for." };
  if (text.length > MAX_LENGTH) return { ok: false, reason: `Keep it under ${MAX_LENGTH} characters.` };
  if (!ALLOWED.test(text)) return { ok: false, reason: "Use letters, numbers and simple punctuation only." };
  if (UNSAFE.test(text) || (pack === "clothing" && NOT_FOR_CLOTHING.test(text))) return { ok: false, reason: "We can't show that." };
  return { ok: true, text };
}

/**
 * A store's product title with words that try to steer the image model taken out. Titles are
 * written by strangers, so they only ever describe the product.
 */
export function withoutSteering(title: string): string {
  return title.replace(new RegExp(STEERING.source, "gi"), " ").replace(/\s+/g, " ").trim();
}

/** False for a found product we must not show in this category (checked on its store title). */
export function isAllowedProduct(title: string, pack: PackId): boolean {
  return !UNSAFE.test(title) && !(pack === "clothing" && NOT_FOR_CLOTHING.test(title));
}

/**
 * Validates a free-text swap ("matte black wheels"). Not offered for clothing: people's
 * photos only get real catalog products.
 */
export function cleanDescription(raw: string, pack: PackId): Described {
  if (pack === "clothing") return { ok: false, reason: "For clothing, pick a product from the list." };
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return { ok: false, reason: "Describe what you want, for example “matte black”." };
  if (text.length > MAX_LENGTH) return { ok: false, reason: `Keep it under ${MAX_LENGTH} characters.` };
  if (!ALLOWED.test(text)) return { ok: false, reason: "Use letters, numbers and simple punctuation only." };
  if (STEERING.test(text) || UNSAFE.test(text)) return { ok: false, reason: "We can't make that swap." };
  return { ok: true, text };
}
