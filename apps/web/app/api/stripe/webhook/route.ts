import type Stripe from "stripe";
import { getAccounts, getStripe } from "@/lib/server/accounts";
import { fulfillCheckout, REVERSAL_EVENTS, reversedPaymentIntent, reversePayment } from "@/lib/server/checkout";

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

/** Adds the credits. Per Stripe's fulfillment guide, re-read the session instead of trusting the event's copy. */
async function onPaid(event: Stripe.Event): Promise<string> {
  const { id } = event.data.object as Stripe.Checkout.Session;
  const session = await getStripe().checkout.sessions.retrieve(id);
  return (await fulfillCheckout(session, getAccounts().credits)).status;
}

/** Takes the credits back after a refund or a dispute. */
async function onReversed(event: Stripe.Event): Promise<string> {
  const paymentIntent = reversedPaymentIntent(event);
  if (!paymentIntent) return "unknown";
  const result = await reversePayment(paymentIntent, {
    findSessionId: async (pi) => (await getStripe().checkout.sessions.list({ payment_intent: pi, limit: 1 })).data[0]?.id ?? null,
    credits: getAccounts().credits,
  });
  if (result.status === "reversed") console.info("[stripe] credits taken back", event.type, result.removed);
  return result.status;
}

/**
 * Stripe → us. The signature proves the event is real. A 500 makes Stripe retry later.
 * Stripe waits up to 10 s for this before sending the buyer back, so it stays quick.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return new Response("Not configured", { status: 400 });

  const payload = await request.text();
  let event;
  try {
    event = await getStripe().webhooks.constructEventAsync(payload, signature, secret);
  } catch (error) {
    console.error("[stripe] bad webhook signature", error);
    return new Response("Bad signature", { status: 400 });
  }

  const handler = PAID_EVENTS.has(event.type) ? onPaid : REVERSAL_EVENTS.has(event.type) ? onReversed : null;
  if (!handler) return new Response("Ignored", { status: 200 });

  try {
    return new Response(await handler(event), { status: 200 });
  } catch (error) {
    console.error("[stripe] webhook failed", event.type, event.id, error);
    return new Response("Retry", { status: 500 });
  }
}
