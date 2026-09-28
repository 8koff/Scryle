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

/** Stripe card fee: 2.9% + 30¢. */
const stripeFeeCents = (priceCents: number) => priceCents * 0.029 + 30;

/** Share of the price we keep if every credit is used, at `renderCostCents` per render. */
export function packMargin(pack: CreditPack, renderCostCents: number): number {
  const cost = pack.credits * renderCostCents + stripeFeeCents(pack.priceCents);
  return (pack.priceCents - cost) / pack.priceCents;
}

/** "$4.99", "$2,799.99": always two decimals, commas for thousands. */
export const formatUsd = (cents: number) =>
  `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
