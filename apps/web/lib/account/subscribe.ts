import { offersFromPackages, previewOffers, type PlanOffer } from "@retrofit/core";
import type { Package, Purchases as PurchasesInstance } from "@revenuecat/purchases-js";

/**
 * Subscribing on the website through RevenueCat Web Billing (Stripe underneath), same plans as the
 * iPhone app (docs/plans/subscriptions-revenuecat.md). The browser only buys: RevenueCat tells our
 * server, the server decides the plan and its swaps, and the page reads that back from /api/credits.
 * RevenueCat shows its own payment form on the page, so there's no redirect to Stripe.
 */

/** RevenueCat's public Web Billing key (starts with rcb_). Public by design. */
const KEY = process.env.NEXT_PUBLIC_REVENUECAT_WEB_KEY?.trim() || undefined;

export type WebOffer = PlanOffer<Package>;
export type WebOffers =
  | { status: "ready"; offers: WebOffer[] }
  | { status: "preview"; offers: PlanOffer[]; message: string }
  | { status: "unavailable"; message: string };

/** Loaded on first use: the SDK and Stripe only download when someone opens the plans. */
async function sdkFor(userId: string): Promise<PurchasesInstance | null> {
  if (!KEY) return null;
  const { Purchases } = await import("@revenuecat/purchases-js");
  if (!Purchases.isConfigured()) return Purchases.configure({ apiKey: KEY, appUserId: userId });
  const instance = Purchases.getSharedInstance();
  // Someone else signed in on this browser: purchases must go to their account, not the last one.
  if (instance.getAppUserId() !== userId) await instance.changeUser(userId);
  return instance;
}

/** The plans in RevenueCat's current offering, or previews in development without a key. */
export async function loadWebOffers(userId: string): Promise<WebOffers> {
  let purchases: PurchasesInstance | null;
  try {
    purchases = await sdkFor(userId);
  } catch {
    return { status: "unavailable", message: "Payments aren't working right now. Please try again." };
  }
  if (!purchases) {
    return process.env.NODE_ENV !== "production"
      ? { status: "preview", offers: previewOffers(), message: "No RevenueCat web key in this build." }
      : { status: "unavailable", message: "Subscriptions aren't set up yet. Please try again later." };
  }
  try {
    const packages = (await purchases.getOfferings()).current?.availablePackages ?? [];
    const offers = offersFromPackages(
      packages.map((pkg) => ({ pkg, product: { identifier: pkg.webBillingProduct.identifier, priceString: pkg.webBillingProduct.currentPrice.formattedPrice } })),
    ).map((o) => ({ ...o, pkg: o.pkg?.pkg }));
    return offers.length ? { status: "ready", offers } : { status: "unavailable", message: "The plans aren't available right now. Please try again later." };
  } catch {
    return { status: "unavailable", message: "Payments aren't working right now. Please try again." };
  }
}

export type SubscribeResult = { kind: "active" } | { kind: "pending" } | { kind: "cancelled" } | { kind: "error"; message: string };

/** How long to wait for RevenueCat → our server after the payment. Usually a few seconds. */
const CONFIRM_MS = 30_000;
const CONFIRM_EVERY_MS = 2_000;

/**
 * Pays for a plan in RevenueCat's on-page form, then asks our server until it reports the plan.
 * `refresh` re-reads /api/credits and says whether the account has a plan now.
 */
export async function subscribeWeb(
  offer: PlanOffer,
  userId: string,
  refresh: () => Promise<boolean>,
  email?: string,
): Promise<SubscribeResult> {
  if (!offer.pkg) return { kind: "error", message: "Preview only: this build can't take payments, so nothing was bought." };
  const purchases = await sdkFor(userId).catch(() => null);
  if (!purchases) return { kind: "error", message: "Payments aren't working right now. Please try again." };
  try {
    await purchases.purchase({ rcPackage: offer.pkg as Package, customerEmail: email });
  } catch (error) {
    const { ErrorCode } = await import("@revenuecat/purchases-js");
    if ((error as { errorCode?: number })?.errorCode === ErrorCode.UserCancelledError) return { kind: "cancelled" };
    return { kind: "error", message: (error as { message?: string })?.message || "The payment didn't go through. Please try again." };
  }
  const deadline = Date.now() + CONFIRM_MS;
  while (Date.now() < deadline) {
    if (await refresh()) return { kind: "active" };
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_EVERY_MS));
  }
  return { kind: "pending" };
}
