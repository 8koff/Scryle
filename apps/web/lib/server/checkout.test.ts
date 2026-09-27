import type Stripe from "stripe";
import { describe, expect, it } from "vitest";
import { checkoutParams, fulfillCheckout, reversedPaymentIntent, reversePayment, safeReturnPath } from "./checkout";
import { createMemoryCreditStore } from "./credits";

const user = { id: "u1", email: "a@example.com" };

const session = (overrides: Partial<Stripe.Checkout.Session> = {}) =>
  ({
    id: "cs_test_1",
    payment_status: "paid",
    amount_total: 499,
    currency: "usd",
    client_reference_id: "u1",
    metadata: { user_id: "u1", pack: "starter" },
    ...overrides,
  }) as Stripe.Checkout.Session;

describe("safeReturnPath", () => {
  it("allows the home page and a build page only", () => {
    expect(safeReturnPath("/build/abc123")).toBe("/build/abc123");
    expect(safeReturnPath("/")).toBe("/");
    expect(safeReturnPath("/renders")).toBe("/renders");
    expect(safeReturnPath("/renders/x")).toBe("/");
    expect(safeReturnPath("https://evil.example")).toBe("/");
    expect(safeReturnPath("//evil.example")).toBe("/");
    expect(safeReturnPath("/build/../../x")).toBe("/");
    expect(safeReturnPath(undefined)).toBe("/");
  });
});

describe("checkoutParams", () => {
  it("prices the pack from our own list and tags it with the user", () => {
    const params = checkoutParams({ packId: "starter", user, origin: "https://scry.test", returnTo: "/build/abc" });
    expect(params.mode).toBe("payment");
    expect(params.line_items?.[0]?.price_data?.unit_amount).toBe(499);
    expect(params.client_reference_id).toBe("u1");
    expect(params.metadata).toEqual({ user_id: "u1", pack: "starter" });
    expect(params.success_url).toBe("https://scry.test/build/abc?checkout=done&session_id={CHECKOUT_SESSION_ID}");
    expect(params.cancel_url).toBe("https://scry.test/build/abc");
  });

  it("tells the buyer on Stripe's page that all sales are final", () => {
    const params = checkoutParams({ packId: "starter", user, origin: "https://x", returnTo: "/" });
    expect(params.custom_text?.submit).toMatchObject({ message: expect.stringMatching(/All sales are final/) });
    expect(params.line_items?.[0]?.price_data?.product_data?.name).toBe("Scryle Starter: 25 swaps");
  });

  it("rejects unknown packs", () => {
    expect(() => checkoutParams({ packId: "free", user, origin: "https://x", returnTo: "/" })).toThrow();
  });
});

describe("fulfillCheckout", () => {
  it("adds the pack's credits once, even if Stripe tells us twice", async () => {
    const credits = createMemoryCreditStore();
    expect(await fulfillCheckout(session(), credits)).toEqual({ status: "added", userId: "u1", added: 25 });
    expect(await fulfillCheckout(session(), credits)).toEqual({ status: "already", userId: "u1", added: 0 });
    expect(await credits.balance("u1")).toBe(25);
  });

  it("waits for unpaid sessions", async () => {
    const credits = createMemoryCreditStore();
    expect((await fulfillCheckout(session({ payment_status: "unpaid" }), credits)).status).toBe("unpaid");
    expect(await credits.balance("u1")).toBe(0);
  });

  it("refuses a session whose amount doesn't match the pack", async () => {
    const credits = createMemoryCreditStore();
    expect((await fulfillCheckout(session({ amount_total: 1 }), credits)).status).toBe("invalid");
    expect((await fulfillCheckout(session({ currency: "eur" }), credits)).status).toBe("invalid");
    expect((await fulfillCheckout(session({ metadata: { user_id: "u1", pack: "nope" } }), credits)).status).toBe("invalid");
    expect((await fulfillCheckout(session({ client_reference_id: "u2" }), credits)).status).toBe("invalid");
    expect(await credits.balance("u1")).toBe(0);
  });
});

describe("reversePayment", () => {
  const findSessionId = async (pi: string) => (pi === "pi_1" ? "cs_test_1" : null);

  it("takes the pack's credits back once, even if Stripe tells us twice", async () => {
    const credits = createMemoryCreditStore();
    await fulfillCheckout(session(), credits);
    expect(await reversePayment("pi_1", { findSessionId, credits })).toEqual({ status: "reversed", removed: 25 });
    expect(await reversePayment("pi_1", { findSessionId, credits })).toEqual({ status: "already", removed: 0 });
    expect(await credits.balance("u1")).toBe(0);
  });

  it("can leave the balance below zero when the credits were already used", async () => {
    const credits = createMemoryCreditStore();
    await fulfillCheckout(session(), credits);
    await credits.spend("u1");
    await reversePayment("pi_1", { findSessionId, credits });
    expect(await credits.balance("u1")).toBe(-1);
    expect(await credits.spend("u1")).toBeNull();
  });

  it("ignores payments that didn't buy credits", async () => {
    const credits = createMemoryCreditStore();
    expect(await reversePayment("pi_other", { findSessionId, credits })).toEqual({ status: "unknown", removed: 0 });
  });
});

describe("reversedPaymentIntent", () => {
  const event = (type: string, object: unknown) => ({ type, data: { object } }) as unknown as Stripe.Event;

  it("reads the payment from a refund and from a dispute", () => {
    expect(reversedPaymentIntent(event("charge.refunded", { payment_intent: "pi_1" }))).toBe("pi_1");
    expect(reversedPaymentIntent(event("charge.dispute.created", { payment_intent: { id: "pi_2" } }))).toBe("pi_2");
  });

  it("ignores other events", () => {
    expect(reversedPaymentIntent(event("checkout.session.completed", { payment_intent: "pi_1" }))).toBeNull();
  });
});
