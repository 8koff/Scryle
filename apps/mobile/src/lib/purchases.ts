import { offersFromPackages, previewOffers, type PlanInfo, type PlanOffer } from "@retrofit/core";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { API_URL, REVENUECAT_IOS_KEY } from "./config";

import { account } from "./use-account";

/**
 * Subscriptions through RevenueCat (docs/plans/subscriptions-revenuecat.md). The phone only buys:
 * RevenueCat tells our server, the server decides the plan and its swaps, and the app reads that
 * back from /api/credits. Nothing here grants swaps or unlocks screens by itself.
 */

type Sdk = typeof import("react-native-purchases").default;
export type Offer = PlanOffer<PurchasesPackage>;

/** Buying needs a real build (not Expo Go), the iOS key, and iOS. */
export const canBuyHere = () =>
  Platform.OS === "ios" && Boolean(REVENUECAT_IOS_KEY) && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let sdk: Promise<Sdk | null> | null = null;
/** Loaded on first use, so the app still opens in Expo Go and without a key. */
function loadSdk(): Promise<Sdk | null> {
  // Lazy native loading keeps Expo Go usable and works in both Metro and Jest.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sdk ??= canBuyHere() ? Promise.resolve().then(() => require("react-native-purchases").default as Sdk).catch(() => null) : Promise.resolve(null);
  return sdk;
}

let identifiedAs: string | null = null;

/**
 * Tells RevenueCat who is signed in. The app user id is our account id, which is how the server
 * matches a purchase to an account and how a plan bought here also works on the website.
 */
async function identifyNow(userId: string | null): Promise<void> {
  const Purchases = await loadSdk();
  if (!Purchases || userId === identifiedAs) return;
  try {
    if (!(await Purchases.isConfigured())) {
      if (!userId) return;
      Purchases.configure({ apiKey: REVENUECAT_IOS_KEY!, appUserID: userId });
    } else if (userId) {
      await Purchases.logIn(userId);
    } else {
      await Purchases.logOut();
    }
    identifiedAs = userId;
  } catch (error) {
    // Logging out an anonymous user throws; anything else is retried on the next sign-in.
    console.warn("[purchases] couldn't switch user", error);
  }
}

// Keep sign-in/sign-out operations in order when the account changes quickly.
let identityQueue: Promise<void> = Promise.resolve();
export function identify(userId: string | null): Promise<void> {
  identityQueue = identityQueue.then(() => identifyNow(userId));
  return identityQueue;
}

const signedInUser = () => {
  const me = account.getSnapshot();
  return me.status === "signed-in" ? me.userId : null;
};

/** Never open a payment sheet for an anonymous or previously signed-in account. */
async function sdkForAccount(): Promise<{ Purchases: Sdk; userId: string } | null> {
  const userId = signedInUser();
  if (!userId) return null;
  await identify(userId);
  const Purchases = await loadSdk();
  return Purchases && identifiedAs === userId && signedInUser() === userId ? { Purchases, userId } : null;
}

export type Offers = { status: "ready"; offers: Offer[] } | { status: "preview"; offers: PlanOffer[]; message: string } | { status: "unavailable"; message: string };

const STORE_DOWN = "Couldn't reach the App Store. Check your connection and try again.";

/** The plans in RevenueCat's current offering, or previews in a development build without a key. */
export async function loadOffers(): Promise<Offers> {
  const Purchases = await loadSdk();
  if (!Purchases) {
    return __DEV__
      ? { status: "preview", offers: previewOffers(), message: "This development build has no RevenueCat key." }
      : { status: "unavailable", message: "Subscriptions work in the TestFlight or App Store version of Scryle." };
  }
  try {
    const ready = await sdkForAccount();
    if (!ready) return { status: "unavailable", message: "Couldn't connect your account to the App Store. Please try again." };
    const offering = (await ready.Purchases.getOfferings()).current;
    const offers = offersFromPackages(offering?.availablePackages ?? []);
    return offers.length ? { status: "ready", offers } : { status: "unavailable", message: "The plans aren't available right now. Please try again later." };
  } catch {
    return { status: "unavailable", message: STORE_DOWN };
  }
}

export type BuyResult = { kind: "active" } | { kind: "pending" } | { kind: "cancelled" } | { kind: "error"; message: string };

/** How long to wait for RevenueCat → our server after Apple says yes. Usually a few seconds. */
const CONFIRM_MS = 30_000;
const CONFIRM_EVERY_MS = 2_000;

/** Asks our server until it reports a plan. The plan only counts once the server has it. */
async function waitForPlan(userId: string): Promise<BuyResult> {
  const deadline = Date.now() + CONFIRM_MS;
  while (Date.now() < deadline) {
    if (signedInUser() !== userId) return { kind: "cancelled" };
    await account.refreshCredits();
    const me = account.getSnapshot();
    if (signedInUser() !== userId) return { kind: "cancelled" };
    if (me.status === "signed-in" && me.plan) return { kind: "active" };
    await new Promise((resolve) => setTimeout(resolve, CONFIRM_EVERY_MS));
  }
  return { kind: "pending" };
}

const isCancel = (Purchases: Sdk, error: unknown) => {
  const e = error as { userCancelled?: boolean | null; code?: string } | null;
  return Boolean(e?.userCancelled) || e?.code === Purchases.PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
};

/** Subscribes (or changes plan). Apple shows its own sheet; then we wait for our server. */
export async function buyPlan(offer: PlanOffer): Promise<BuyResult> {
  if (!offer.pkg) return { kind: "error", message: "Preview only: this development build can't subscribe, so nothing was bought." };
  const ready = await sdkForAccount();
  if (!ready) return { kind: "error", message: "Couldn't connect your account to the App Store. Please try again." };
  const { Purchases, userId } = ready;
  try {
    await Purchases.purchasePackage(offer.pkg as PurchasesPackage);
  } catch (error) {
    if (isCancel(Purchases, error)) return { kind: "cancelled" };
    return { kind: "error", message: (error as { message?: string })?.message || "The purchase didn't go through. Please try again." };
  }
  return waitForPlan(userId);
}

/** Restore purchases (Apple requires this button): re-links an existing plan to this account. */
export async function restorePlan(): Promise<BuyResult> {
  const ready = await sdkForAccount();
  if (!ready) return { kind: "error", message: "Couldn't connect your account to the App Store. Please try again." };
  const { Purchases, userId } = ready;
  try {
    const info = await Purchases.restorePurchases();
    if (!info.entitlements.active.swaps) return { kind: "error", message: "No active plan was found for this Apple ID." };
  } catch {
    return { kind: "error", message: STORE_DOWN };
  }
  return waitForPlan(userId);
}

/**
 * Where to cancel or change a plan: Apple's subscription page for plans bought in the app, the
 * website's account page for plans bought there (Apple can't manage those).
 */
export async function manageSubscription(plan: PlanInfo): Promise<void> {
  const Purchases = plan.store === "app_store" ? await loadSdk() : null;
  if (Purchases) {
    try {
      return await Purchases.showManageSubscriptions();
    } catch {
      // Falls through to Apple's page in the browser.
    }
  }
  const url = plan.store === "app_store" ? "https://apps.apple.com/account/subscriptions" : `${API_URL}/app/account`;
  await WebBrowser.openBrowserAsync(url);
}
