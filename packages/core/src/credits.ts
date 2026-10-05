/**
 * Credits: one AI render costs one credit. Shared by web and the future app so prices
 * never drift. Change the packs here; the checkout and the paywall read from this list.
 */

/** Every new account gets this many renders free. */
export const FREE_RENDERS = 1;

/** How many items (swaps) one picture can change at once. The server and the studio both check it. */
export const MAX_SWAPS_PER_PICTURE = 6;

/** Renders each person gets when an invited friend buys their first pack. */
export const INVITE_RENDERS = 2;

/**
 * Chosen 2026-09-27. No pack under $4.99: Stripe's fixed 30¢ would eat too much of it.
 * `isBestValue` marks the pack the pricing section points people to.
 */
export const CREDIT_PACKS = [
  { id: "starter", label: "Starter", credits: 25, priceCents: 499, isBestValue: false },
  { id: "plus", label: "Plus", credits: 60, priceCents: 999, isBestValue: false },
  { id: "pro", label: "Pro", credits: 150, priceCents: 1999, isBestValue: true },
] as const;

export type CreditPack = (typeof CREDIT_PACKS)[number];
export type CreditPackId = CreditPack["id"];

export function isCreditPackId(id: string): id is CreditPackId {
  return CREDIT_PACKS.some((p) => p.id === id);
}

export function creditPack(id: string): CreditPack | undefined {
  return CREDIT_PACKS.find((p) => p.id === id);
}

/**
 * How much cheaper each swap is than in the smallest pack, in whole percent. Rounded down so
 * the pricing never overstates the saving. 0 for the smallest pack itself.
 */
export function packSavingPercent(pack: CreditPack): number {
  const base = CREDIT_PACKS[0];
  const saving = 1 - pack.priceCents / pack.credits / (base.priceCents / base.credits);
  return Math.max(0, Math.floor(saving * 100 + 1e-9));
}

/**
 * The iOS app sells the same packs through Apple, at the same prices. Each pack is one
 * consumable product in App Store Connect with this id ("io.scryapp.credits.starter").
 */
export const APPLE_PRODUCT_PREFIX = "io.scryapp.credits.";

export const appleProductId = (pack: CreditPack) => `${APPLE_PRODUCT_PREFIX}${pack.id}`;

/** The pack an App Store product id sells, or undefined for any other id. */
export function creditPackForAppleProduct(productId: string): CreditPack | undefined {
  if (!productId.startsWith(APPLE_PRODUCT_PREFIX)) return undefined;
  return creditPack(productId.slice(APPLE_PRODUCT_PREFIX.length));
}

export type PaymentStore = "stripe" | "apple";

/** Stripe card fee: 2.9% + 30¢. Apple: 15% (App Store Small Business Program). */
const feeCents: Record<PaymentStore, (priceCents: number) => number> = {
  stripe: (priceCents) => priceCents * 0.029 + 30,
  apple: (priceCents) => priceCents * 0.15,
};

/** Share of the price we keep if every credit is used, at `renderCostCents` per render. */
export function packMargin(pack: CreditPack, renderCostCents: number, store: PaymentStore = "stripe"): number {
  const cost = pack.credits * renderCostCents + feeCents[store](pack.priceCents);
  return (pack.priceCents - cost) / pack.priceCents;
}

/** "$4.99", "$2,799.99": always two decimals, commas for thousands. */
export const formatUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
