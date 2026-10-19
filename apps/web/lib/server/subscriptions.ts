import { timingSafeEqual } from "node:crypto";
import { allowanceMonthStart, getPlanTier, planForProduct, type PlanInfo, type PlanPeriod, type PlanTierId } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

/**
 * Subscriptions through RevenueCat (docs/plans/subscriptions-revenuecat.md). RevenueCat tells us who
 * is subscribed to which plan; this file turns that into a row in `subscriptions`, and the credit
 * store turns the row into this month's swaps. Swaps are only ever granted here, on the server.
 */

/** One account's plan, as RevenueCat last reported it. */
export type Subscription = {
  userId: string;
  productId: string;
  tier: PlanTierId;
  period: PlanPeriod;
  store: string;
  /**
   * When the current billing period began: allowance months count from here. An upgrade starts a new billing
   * period (Apple refunds the unused part of the old plan), so it also starts a fresh month with the new
   * plan's full allowance; what was used on the old plan isn't carried over (owner's choice, 2026-10-19).
   */
  periodStart: Date;
  expiresAt: Date;
  willRenew: boolean;
  /** Set while Apple or Stripe can't take the renewal payment. */
  billingIssueAt: Date | null;
  refundedAt: Date | null;
};

/**
 * Whether this plan gives swaps right now. Called on every balance check and every swap, so it
 * decides what someone in each billing situation can do.
 */
export function hasAccess(sub: Subscription, now: Date): boolean {
  // Refunded: the money went back, so the plan stops at once.
  if (sub.refundedAt) return false;
  // Cancelled plans keep their swaps until the paid period ends (willRenew doesn't matter here).
  // A failing payment doesn't cut access by itself: we fold RevenueCat's separate grace-period date into
  // expiresAt, and once the grace period runs out without payment, expiresAt has passed.
  return sub.expiresAt > now;
}

/** This month's allowance: which month, and how many swaps the plan gives in it. */
export type Allowance = { monthStart: Date; granted: number };

export function currentAllowance(sub: Subscription | null, now: Date): Allowance | null {
  if (!sub || !hasAccess(sub, now)) return null;
  const plan = planForProduct(sub.productId);
  if (!plan) return null;
  return { monthStart: allowanceMonthStart(sub.periodStart, now), granted: plan.tier.swapsPerMonth };
}

/** The plan as the app shows it, or null when no plan gives swaps right now (the app's paywall shows). */
export function planInfo(sub: Subscription | null, now: Date): PlanInfo | null {
  const allowance = currentAllowance(sub, now);
  const tier = sub && getPlanTier(sub.tier);
  if (!sub || !allowance || !tier) return null;
  return {
    tier: tier.id,
    period: sub.period,
    swapsPerMonth: allowance.granted,
    monthStart: allowance.monthStart.toISOString(),
    expiresAt: sub.expiresAt.toISOString(),
    willRenew: sub.willRenew,
    hasBillingIssue: Boolean(sub.billingIssueAt),
    store: sub.store,
  };
}

// ---- Storage ---------------------------------------------------------------------------------

export type SubscriptionStore = {
  get(userId: string): Promise<Subscription | null>;
  /** Saves what RevenueCat reports now. Overwrites: RevenueCat is re-read on every event. */
  save(sub: Subscription): Promise<void>;
  /** RevenueCat has no plan for this account (never bought, or transferred away). */
  remove(userId: string): Promise<void>;
};

type Row = {
  user_id: string;
  product_id: string;
  tier: PlanTierId;
  period: PlanPeriod;
  store: string;
  period_start: string;
  expires_at: string;
  will_renew: boolean;
  billing_issue_at: string | null;
  refunded_at: string | null;
};

const date = (value: string | null) => (value ? new Date(value) : null);

export function createSupabaseSubscriptionStore(db: SupabaseClient): SubscriptionStore {
  return {
    async get(userId) {
      const { data, error } = await db.from("subscriptions").select("*").eq("user_id", userId).maybeSingle<Row>();
      if (error) throw new Error(`[subscriptions] read failed: ${error.message}`);
      if (!data) return null;
      return {
        userId: data.user_id,
        productId: data.product_id,
        tier: data.tier,
        period: data.period,
        store: data.store,
        periodStart: new Date(data.period_start),
        expiresAt: new Date(data.expires_at),
        willRenew: data.will_renew,
        billingIssueAt: date(data.billing_issue_at),
        refundedAt: date(data.refunded_at),
      };
    },
    async save(sub) {
      const row: Row & { updated_at: string } = {
        user_id: sub.userId,
        product_id: sub.productId,
        tier: sub.tier,
        period: sub.period,
        store: sub.store,
        period_start: sub.periodStart.toISOString(),
        expires_at: sub.expiresAt.toISOString(),
        will_renew: sub.willRenew,
        billing_issue_at: sub.billingIssueAt?.toISOString() ?? null,
        refunded_at: sub.refundedAt?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      };
      const { error } = await db.from("subscriptions").upsert(row, { onConflict: "user_id" });
      if (error) throw new Error(`[subscriptions] save failed: ${error.message}`);
    },
    async remove(userId) {
      const { error } = await db.from("subscriptions").delete().eq("user_id", userId);
      if (error) throw new Error(`[subscriptions] remove failed: ${error.message}`);
    },
  };
}

export function createMemorySubscriptionStore(seed: Subscription[] = []): SubscriptionStore & { rows: Map<string, Subscription> } {
  const rows = new Map(seed.map((s) => [s.userId, s]));
  return {
    rows,
    get: async (userId) => rows.get(userId) ?? null,
    save: async (sub) => void rows.set(sub.userId, sub),
    remove: async (userId) => void rows.delete(userId),
  };
}

// ---- RevenueCat ------------------------------------------------------------------------------

/** The entitlement every plan unlocks in RevenueCat. */
export const ENTITLEMENT = "swaps";

/** The parts of RevenueCat's customer record (GET /v1/subscribers/:id) we read. */
const CustomerSchema = z.object({
  subscriber: z.object({
    entitlements: z.record(z.string(), z.object({ product_identifier: z.string() }).loose()).default({}),
    subscriptions: z
      .record(
        z.string(),
        z
          .object({
            purchase_date: z.string(),
            expires_date: z.string().nullable(),
            grace_period_expires_date: z.string().nullable().optional(),
            store: z.string(),
            unsubscribe_detected_at: z.string().nullable().optional(),
            billing_issues_detected_at: z.string().nullable().optional(),
            refunded_at: z.string().nullable().optional(),
            /** A test purchase (TestFlight, App Review, sandbox testers): nobody paid for it. */
            is_sandbox: z.boolean().optional(),
          })
          .loose(),
      )
      .default({}),
  }),
});
export type Customer = z.infer<typeof CustomerSchema>;

/**
 * The plan in a RevenueCat customer record, or null when there's none. The product behind the
 * `swaps` entitlement wins; without it (e.g. expired), the known plan that expires last.
 * Test purchases are free, so they only count for accounts allowed to test (`allowSandbox`).
 */
export function subscriptionFromCustomer(userId: string, customer: Customer, { allowSandbox = false } = {}): Subscription | null {
  const { entitlements, subscriptions } = customer.subscriber;
  const known = Object.entries(subscriptions).flatMap(([productId, s]) => {
    const plan = planForProduct(productId);
    if (!plan || !s.expires_date) return [];
    // Fails closed: a purchase RevenueCat doesn't mark as real (is_sandbox: false) counts as a test.
    if (s.is_sandbox !== false && !allowSandbox) return [];
    const paidUntil = new Date(s.expires_date);
    const graceUntil = date(s.grace_period_expires_date ?? null);
    const expiresAt = graceUntil && graceUntil > paidUntil ? graceUntil : paidUntil;
    return [{ productId, plan, s, expiresAt }];
  });
  const entitled = entitlements[ENTITLEMENT]?.product_identifier;
  const chosen = known.find((k) => k.productId === entitled) ?? known.sort((a, b) => +b.expiresAt - +a.expiresAt)[0];
  if (!chosen) return null;
  const { productId, plan, s, expiresAt } = chosen;
  return {
    userId,
    productId,
    tier: plan.tier.id,
    period: plan.period,
    store: s.store,
    periodStart: new Date(s.purchase_date),
    expiresAt,
    willRenew: !s.unsubscribe_detected_at,
    billingIssueAt: date(s.billing_issues_detected_at ?? null),
    refundedAt: date(s.refunded_at ?? null),
  };
}

export type RevenueCatApi = { customer(appUserId: string): Promise<Customer> };

export type RevenueCatClient = RevenueCatApi & {
  /**
   * Deletes the customer from RevenueCat (for "Delete account"). RevenueCat then cancels a plan bought on the
   * website and erases what it keeps about them; an Apple plan keeps renewing until they cancel it with Apple.
   */
  deleteCustomer(appUserId: string): Promise<void>;
};

/** RevenueCat's API with the secret key. Throws on any failure, so the webhook is retried. */
export function revenueCatApiFromEnv(env: Record<string, string | undefined> = process.env, doFetch: typeof fetch = fetch): RevenueCatClient {
  const key = env.REVENUECAT_SECRET_API_KEY?.trim();
  const call = (appUserId: string, method: "GET" | "DELETE") => {
    if (!key) throw new Error("[revenuecat] REVENUECAT_SECRET_API_KEY isn't set");
    return doFetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      method,
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
  };
  return {
    async customer(appUserId) {
      const response = await call(appUserId, "GET");
      if (!response.ok) throw new Error(`[revenuecat] customer read failed: ${response.status}`);
      return CustomerSchema.parse(await response.json());
    },
    async deleteCustomer(appUserId) {
      const response = await call(appUserId, "DELETE");
      // RevenueCat's docs: 404 means there's no such customer, which is just as deleted.
      if (!response.ok && response.status !== 404) throw new Error(`[revenuecat] customer delete failed: ${response.status}`);
    },
  };
}

/**
 * REVENUECAT_SANDBOX_ACCOUNTS: the account ids whose test purchases give a real plan, comma-separated. Meant
 * for the App Review demo account and the owner's own testers; everyone else's test purchases give nothing.
 */
export function sandboxAccountsFromEnv(env: Record<string, string | undefined> = process.env): ReadonlySet<string> {
  const ids = (env.REVENUECAT_SANDBOX_ACCOUNTS ?? "").split(/[\s,]+/).map((id) => id.toLowerCase());
  return new Set(ids.filter((id) => UUID.test(id)));
}

// ---- Webhook ---------------------------------------------------------------------------------

/** Our app user ids are Supabase user ids. Anything else ($RCAnonymousID:…) isn't one of our accounts. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const EventSchema = z.object({
  event: z
    .object({
      id: z.string().optional(),
      type: z.string(),
      app_user_id: z.string().optional(),
      original_app_user_id: z.string().optional(),
      transferred_from: z.array(z.string()).optional(),
      transferred_to: z.array(z.string()).optional(),
    })
    .loose(),
});

/** Checks the Authorization header set on the webhook in RevenueCat's dashboard. */
export function isWebhookAuthorized(header: string | null, expected: string | undefined): boolean {
  const secret = expected?.trim();
  if (!secret || !header) return false;
  const given = Buffer.from(header);
  const wanted = Buffer.from(secret);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export type WebhookResult = { status: number; body: string };

/**
 * RevenueCat → us. Every event type is handled the same way: re-read each account it names from
 * RevenueCat and save what it says now. That makes duplicates, out-of-order delivery and event types
 * we don't know yet all harmless (RevenueCat delivers at least once and adds types over time).
 */
export async function handleWebhook(
  input: { authorization: string | null; body: unknown },
  deps: {
    secret: string | undefined;
    api: RevenueCatApi;
    store: SubscriptionStore;
    /** Accounts whose test purchases count (sandboxAccountsFromEnv). */
    sandboxAccounts?: ReadonlySet<string>;
    /**
     * False for a deleted account. An Apple plan can renew after its account is deleted; reading it would
     * bring the customer back in RevenueCat, and saving it would fail on the missing account.
     */
    accountExists?: (userId: string) => Promise<boolean>;
  },
): Promise<WebhookResult> {
  if (!deps.secret?.trim()) return { status: 503, body: "Not configured" };
  if (!isWebhookAuthorized(input.authorization, deps.secret)) return { status: 401, body: "Unauthorized" };

  const parsed = EventSchema.safeParse(input.body);
  if (!parsed.success) return { status: 400, body: "Bad event" };
  const e = parsed.data.event;
  const ids = [e.app_user_id, e.original_app_user_id, ...(e.transferred_from ?? []), ...(e.transferred_to ?? [])];
  const users = [...new Set(ids.filter((id): id is string => Boolean(id && UUID.test(id))))];
  if (!users.length) return { status: 200, body: "No account" };

  for (const userId of users) {
    if (deps.accountExists && !(await deps.accountExists(userId))) continue;
    const allowSandbox = deps.sandboxAccounts?.has(userId.toLowerCase()) ?? false;
    const sub = subscriptionFromCustomer(userId, await deps.api.customer(userId), { allowSandbox });
    if (sub) await deps.store.save(sub);
    else await deps.store.remove(userId);
  }
  console.info("[revenuecat] event", e.type, e.id, users.length);
  return { status: 200, body: "OK" };
}
