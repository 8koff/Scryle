import { formatUsd } from "./credits";
import { PLAN_TIERS, planForProduct, subscriptionProductId, type PlanPeriod, type PlanTier } from "./subscriptions";

/**
 * One plan as a paywall shows it. Pure (no SDK code), shared by the app (apps/mobile/src/lib/purchases.ts)
 * and the website (apps/web/lib/account/subscribe.ts), which build these from RevenueCat and buy them.
 */
export type PlanOffer<Pkg = unknown> = {
  tier: PlanTier;
  period: PlanPeriod;
  productId: string;
  /** The store's own localized price ("$9.99", "9,99 €"). Never computed by us. */
  priceString: string;
  /** RevenueCat's package to buy. Absent for previews, which can never be bought. */
  pkg?: Pkg;
};

/** The parts of a RevenueCat package we read. */
type PackageLike = { product: { identifier: string; priceString: string } };

const order = (o: PlanOffer) => PLAN_TIERS.findIndex((t) => t.id === o.tier.id) * 2 + (o.period === "monthly" ? 0 : 1);

/**
 * The plans in an offering, in the order the paywall shows them (Starter → Pro, monthly before
 * yearly). Products that aren't one of our plans are left out, and so is a second package for the
 * same product, so a dashboard mistake can't show a plan twice.
 */
export function offersFromPackages<Pkg extends PackageLike>(packages: readonly Pkg[]): PlanOffer<Pkg>[] {
  const seen = new Set<string>();
  const offers: PlanOffer<Pkg>[] = [];
  for (const pkg of packages) {
    const id = pkg.product.identifier;
    const plan = planForProduct(id);
    if (!plan || seen.has(id)) continue;
    seen.add(id);
    offers.push({ tier: plan.tier, period: plan.period, productId: id, priceString: pkg.product.priceString, pkg });
  }
  return offers.sort((a, b) => order(a) - order(b));
}

/**
 * Development builds without a RevenueCat key (this Mac's simulator): the plans at the website's
 * USD prices, for designing the paywall. They have no package, so buying one only says "preview".
 */
export const previewOffers = (): PlanOffer[] =>
  PLAN_TIERS.flatMap((tier) =>
    (["monthly", "yearly"] as const).map((period) => ({
      tier,
      period,
      productId: subscriptionProductId(tier.id, period),
      priceString: formatUsd(period === "monthly" ? tier.monthlyCents : tier.yearlyCents),
    })),
  );

export const isPreview = (offer: PlanOffer) => offer.pkg === undefined;
