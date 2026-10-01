import { appleProductId, CREDIT_PACKS, creditPackForAppleProduct, type CheckoutDone, type CreditPack } from "@retrofit/core";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { postJson } from "./api";
import { account } from "./use-account";

/**
 * Buying swaps with Apple in-app purchase. The order matters for not losing a purchase:
 * Apple charges → we send Apple's signed transaction to our server → the server adds the
 * swaps → only then do we finish the transaction with Apple. If the app closes in between,
 * iOS gives the transaction back on the next start and it is sent again (the server counts
 * each transaction once).
 */

type IapPurchase = { productId: string; purchaseToken?: string | null };
type Iap = typeof import("expo-iap");

export type PackOffer = { pack: CreditPack; productId: string; displayPrice: string };
export type DeliverResult = { status: "added"; added: number; bonus?: number } | { status: "kept"; message: string };

/** Expo Go has no in-app purchase module; buying only works in a real build (TestFlight, App Store). */
export const canBuyHere = () => Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let iap: Promise<Iap | null> | null = null;
/** Loaded on first use, so the app still opens in Expo Go. */
function loadIap(): Promise<Iap | null> {
  iap ??= canBuyHere() ? import("expo-iap").catch(() => null) : Promise.resolve(null);
  return iap;
}

type Listener = (result: DeliverResult) => void;
const listeners = new Set<Listener>();
/** The buy screen listens, to say "25 swaps added". */
export function onDelivered(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Purchases being sent right now, so a replayed transaction isn't sent twice at once. */
const sending = new Set<string>();

/**
 * Sends one purchase to the server and finishes it with Apple only when the swaps are in.
 * Any failure keeps it unfinished, so it is tried again later. Exported for tests.
 */
export async function deliverPurchase(
  purchase: IapPurchase,
  finish: () => Promise<unknown>,
  send: (signedTransaction: string) => ReturnType<typeof postJson<CheckoutDone>> = (signedTransaction) =>
    postJson<CheckoutDone>("/api/apple/purchase", { signedTransaction }),
): Promise<DeliverResult | null> {
  const token = purchase.purchaseToken;
  if (!token || !creditPackForAppleProduct(purchase.productId) || sending.has(token)) return null;
  sending.add(token);
  try {
    const result = await send(token);
    if (result.status === "error") return { status: "kept", message: result.message };
    account.setCredits(result.data.credits);
    await finish();
    return { status: "added", added: result.data.added, ...(result.data.bonus ? { bonus: result.data.bonus } : {}) };
  } finally {
    sending.delete(token);
  }
}

type IapEventPurchase = Parameters<Parameters<Iap["purchaseUpdatedListener"]>[0]>[0];
let connected: Promise<boolean> | null = null;
let isListening = false;

async function handle(lib: Iap, purchase: IapEventPurchase) {
  let result: DeliverResult | null;
  try {
    result = await deliverPurchase(purchase, () => lib.finishTransaction({ purchase, isConsumable: true }));
  } catch {
    // Network or StoreKit error: the purchase stays unfinished and is sent again later.
    result = { status: "kept", message: "the connection dropped" };
  }
  if (result) listeners.forEach((l) => l(result));
}

/** Connects to the App Store once and listens for purchases for as long as the app runs. */
function connect(lib: Iap): Promise<boolean> {
  // The listener goes on first (once), so a transaction StoreKit replays at start-up isn't missed.
  if (!isListening) {
    isListening = true;
    lib.purchaseUpdatedListener((purchase) => void handle(lib, purchase));
  }
  connected ??= lib
    .initConnection()
    .then(() => true)
    .catch(() => {
      connected = null; // try again next time
      return false;
    });
  return connected;
}

/**
 * On every sign-in and app start: send any purchase Apple still holds as unfinished (the app
 * closed mid-purchase, or the server couldn't check it last time).
 */
export async function startPurchases(): Promise<void> {
  const lib = await loadIap();
  if (!lib || !(await connect(lib))) return;
  // Unfinished transactions (StoreKit's queue) and anything the store still lists. `sending`
  // stops the same one being sent twice; the server counts each once anyway.
  const lists = await Promise.allSettled([lib.getPendingTransactionsIOS(), lib.getAvailablePurchases()]);
  for (const list of lists) {
    if (list.status === "fulfilled") for (const purchase of list.value) void handle(lib, purchase);
  }
}

/** The packs with Apple's price for this person's country. Empty when buying isn't possible here. */
export async function loadOffers(): Promise<PackOffer[]> {
  const lib = await loadIap();
  if (!lib) return [];
  await startPurchases();
  const products = await lib.fetchProducts({ skus: CREDIT_PACKS.map(appleProductId), type: "in-app" });
  const list = Array.isArray(products) ? products : [];
  return CREDIT_PACKS.flatMap((pack) => {
    const product = list.find((p) => p.id === appleProductId(pack));
    return product ? [{ pack, productId: product.id, displayPrice: product.displayPrice }] : [];
  });
}

export type BuyError = { kind: "cancelled" } | { kind: "error"; message: string };

/**
 * Opens Apple's payment sheet. The swaps arrive through the listener above. `userId` goes into
 * the purchase (appAccountToken), so the server only adds it to this account.
 */
export async function buy(offer: PackOffer, userId: string): Promise<BuyError | null> {
  const lib = await loadIap();
  if (!lib) return { kind: "error", message: "Buying works in the App Store version of Scryle." };
  try {
    await lib.requestPurchase({ request: { apple: { sku: offer.productId, appAccountToken: userId } }, type: "in-app" });
    return null;
  } catch (error) {
    const code = (error as { code?: string } | null)?.code;
    if (code === lib.ErrorCode.UserCancelled) return { kind: "cancelled" };
    return { kind: "error", message: "The purchase didn't go through. You weren't charged." };
  }
}
