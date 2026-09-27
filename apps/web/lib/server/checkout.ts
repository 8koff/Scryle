import { BRAND, creditPack, INVITE_RENDERS } from "@retrofit/core";
import type Stripe from "stripe";
import type { User } from "./accounts";
import type { CreditStore } from "./credits";

/** Where Stripe may send people back to. Anything else goes home (no open redirects). */
export function safeReturnPath(path: string | undefined): string {
  return path && /^\/(build\/[a-z0-9]{1,20}|renders)?$/.test(path) ? path : "/";
}

/** One Checkout Session for one credit pack. Prices come from our list, never the browser. */
export function checkoutParams({
  packId,
  user,
  origin,
  returnTo,
}: {
  packId: string;
  user: User;
  origin: string;
  returnTo: string;
}): Stripe.Checkout.SessionCreateParams {
  const pack = creditPack(packId);
  if (!pack) throw new Error(`Unknown credit pack: ${packId}`);
  const back = `${origin}${safeReturnPath(returnTo)}`;
  return {
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: pack.priceCents,
          product_data: { name: `${BRAND.name} ${pack.label}: ${pack.credits} swaps` },
        },
      },
    ],
    client_reference_id: user.id,
    ...(user.email ? { customer_email: user.email } : {}),
    metadata: { user_id: user.id, pack: pack.id },
    // Said again on Stripe's page, right above the pay button (see /terms#payments).
    custom_text: { submit: { message: "All sales are final. Swaps you buy don't expire." } },
    success_url: `${back}?checkout=done&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: back,
  };
}

export type Fulfillment = {
  status: "added" | "already" | "unpaid" | "invalid";
  userId?: string;
  added: number;
  /** Renders from an invite, paid on the first purchase. */
  bonus?: number;
};

/**
 * Adds the credits for a finished Checkout. Called by the webhook and by the page when the
 * buyer comes back (whichever is first). Safe to run twice: the ledger counts a session once.
 */
export async function fulfillCheckout(session: Stripe.Checkout.Session, credits: CreditStore): Promise<Fulfillment> {
  const userId = session.metadata?.user_id;
  const pack = creditPack(session.metadata?.pack ?? "");
  const matches =
    userId &&
    pack &&
    session.client_reference_id === userId &&
    session.amount_total === pack.priceCents &&
    session.currency === "usd";
  if (!matches) {
    console.error("[checkout] session doesn't match a pack", session.id);
    return { status: "invalid", added: 0 };
  }
  if (session.payment_status !== "paid") return { status: "unpaid", userId, added: 0 };

  const isNew = await credits.addPurchase(userId, pack.credits, session.id);
  if (!isNew) return { status: "already", userId, added: 0 };
  // The purchase is safe either way; a failed invite reward is logged, not retried by Stripe.
  const rewarded = await credits.rewardInvite(userId, INVITE_RENDERS).catch((error) => {
    console.error("[checkout] invite reward failed", userId, error);
    return false;
  });
  return { status: "added", userId, added: pack.credits, ...(rewarded ? { bonus: INVITE_RENDERS } : {}) };
}

/** Stripe events that take a payment back: a refund (full or partial) or a dispute. */
export const REVERSAL_EVENTS = new Set(["charge.refunded", "charge.dispute.created"]);

const idOf = (value: string | { id: string } | null | undefined): string | null =>
  typeof value === "string" ? value : (value?.id ?? null);

/** The PaymentIntent behind a refund or dispute event, or null for any other event. */
export function reversedPaymentIntent(event: Stripe.Event): string | null {
  if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
    return idOf(event.data.object.payment_intent);
  }
  return null;
}

export type Reversal = { status: "reversed" | "already" | "unknown"; removed: number };

/**
 * Takes back the credits a refunded or disputed payment bought. Any refund removes the whole
 * pack, so refund in full. Safe to run twice: the ledger reverses a purchase once.
 */
export async function reversePayment(
  paymentIntentId: string,
  { findSessionId, credits }: { findSessionId: (paymentIntentId: string) => Promise<string | null>; credits: CreditStore },
): Promise<Reversal> {
  const sessionId = await findSessionId(paymentIntentId);
  if (!sessionId) return { status: "unknown", removed: 0 };
  const removed = await credits.reversePurchase(sessionId);
  return removed > 0 ? { status: "reversed", removed } : { status: "already", removed: 0 };
}
