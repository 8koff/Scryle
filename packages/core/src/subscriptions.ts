/**
 * Subscriptions (chosen 2026-10-10, docs/plans/subscriptions-revenuecat.md): three plans, each monthly
 * or yearly, sold through Apple in the app and Stripe on the website, both via RevenueCat. A plan gives
 * a number of swaps per month that resets each month: unused swaps don't roll over. There is no free
 * swap and no trial.
 */

export const PLAN_TIERS = [
  { id: "starter", label: "Starter", swapsPerMonth: 25, monthlyCents: 499, yearlyCents: 4999, isBestValue: false },
  { id: "plus", label: "Plus", swapsPerMonth: 60, monthlyCents: 999, yearlyCents: 9999, isBestValue: false },
  { id: "pro", label: "Pro", swapsPerMonth: 150, monthlyCents: 1999, yearlyCents: 19999, isBestValue: true },
] as const;

export type PlanTier = (typeof PLAN_TIERS)[number];
export type PlanTierId = PlanTier["id"];
export type PlanPeriod = "monthly" | "yearly";

export const getPlanTier = (id: string): PlanTier | undefined => PLAN_TIERS.find((t) => t.id === id);

/**
 * The store product id for a plan: the same id in App Store Connect, in RevenueCat and for the web
 * products in RevenueCat Web Billing, so one table maps every store's purchase to a plan.
 */
export const SUBSCRIPTION_PRODUCT_PREFIX = "io.scryapp.sub.";
export const subscriptionProductId = (tier: PlanTierId, period: PlanPeriod) => `${SUBSCRIPTION_PRODUCT_PREFIX}${tier}.${period}`;

/** The plan a store product id stands for, or undefined for anything else (old packs, typos). */
export function planForProduct(productId: string): { tier: PlanTier; period: PlanPeriod } | undefined {
  if (!productId.startsWith(SUBSCRIPTION_PRODUCT_PREFIX)) return undefined;
  const [tierId, period, ...rest] = productId.slice(SUBSCRIPTION_PRODUCT_PREFIX.length).split(".");
  const tier = tierId ? getPlanTier(tierId) : undefined;
  if (!tier || rest.length || (period !== "monthly" && period !== "yearly")) return undefined;
  return { tier, period };
}

/** The yearly price's saving over twelve monthly payments, in whole percent, rounded down. */
export const yearlySavingPercent = (tier: PlanTier) => Math.floor((1 - tier.yearlyCents / (tier.monthlyCents * 12)) * 100 + 1e-9);

/**
 * `anchor` plus `months` calendar months, in UTC. A day that doesn't exist in the target month is
 * clamped to its last day (Jan 31 + 1 month = Feb 28/29), the way stores bill monthly plans.
 */
export function addMonthsUtc(anchor: Date, months: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(anchor.getUTCDate(), lastDay);
  return new Date(
    Date.UTC(year, month, day, anchor.getUTCHours(), anchor.getUTCMinutes(), anchor.getUTCSeconds(), anchor.getUTCMilliseconds()),
  );
}

/**
 * Where the current allowance month started. `anchor` is when the current billing period began (the
 * latest purchase or renewal), so a monthly plan has one allowance month per payment and a yearly
 * plan twelve. Each month's swaps are kept under this date, which is what makes "no rollover" work:
 * a new month is a new row, and the old one simply stops counting.
 */
export function allowanceMonthStart(anchor: Date, now: Date): Date {
  if (now <= anchor) return anchor;
  // Rough guess from the calendar, then fixed up for days that don't exist in short months.
  let months = (now.getUTCFullYear() - anchor.getUTCFullYear()) * 12 + now.getUTCMonth() - anchor.getUTCMonth();
  while (months > 0 && addMonthsUtc(anchor, months) > now) months--;
  while (addMonthsUtc(anchor, months + 1) <= now) months++;
  return addMonthsUtc(anchor, months);
}

/**
 * Who bills a plan: Apple ("apple"), the website ("web", RevenueCat Web Billing), or nobody (a free promotional
 * grant). The app and the website only sell a plan where none is billed elsewhere, so nobody pays twice.
 */
export function planBilling(plan: { store: string } | null | undefined): "apple" | "web" | null {
  if (!plan || plan.store === "promotional") return null;
  return plan.store === "app_store" ? "apple" : "web";
}
