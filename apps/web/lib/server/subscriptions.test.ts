import { describe, expect, it, vi } from "vitest";
import { createMemoryCreditStore } from "./credits";
import {
  createMemorySubscriptionStore,
  currentAllowance,
  handleWebhook,
  isWebhookAuthorized,
  planInfo,
  revenueCatApiFromEnv,
  sandboxAccountsFromEnv,
  subscriptionFromCustomer,
  type Customer,
  type RevenueCatApi,
  type Subscription,
} from "./subscriptions";

const USER = "11111111-2222-4333-8444-555555555555";
const OTHER = "99999999-8888-4777-8666-555555555555";
const at = (iso: string) => new Date(iso);

const sub = (over: Partial<Subscription> = {}): Subscription => ({
  userId: USER,
  productId: "io.scryapp.sub.starter.monthly",
  tier: "starter",
  period: "monthly",
  store: "app_store",
  periodStart: at("2026-10-03T12:00:00Z"),
  expiresAt: at("2026-11-03T12:00:00Z"),
  willRenew: true,
  billingIssueAt: null,
  refundedAt: null,
  ...over,
});

/** RevenueCat marks every purchase real or test; these are real unless a test says otherwise. */
const customer = (subs: Customer["subscriber"]["subscriptions"], entitled?: string): Customer => ({
  subscriber: {
    entitlements: entitled ? { swaps: { product_identifier: entitled } } : {},
    subscriptions: Object.fromEntries(Object.entries(subs).map(([id, s]) => [id, { is_sandbox: false, ...s }])),
  },
});

describe("subscriptionFromCustomer", () => {
  it("keeps access through Apple's grace period, then stops it", () => {
    const result = subscriptionFromCustomer(USER, customer({
      "io.scryapp.sub.starter.monthly": {
        purchase_date: "2026-09-03T12:00:00Z", expires_date: "2026-10-03T12:00:00Z",
        grace_period_expires_date: "2026-10-10T12:00:00Z", store: "app_store",
        billing_issues_detected_at: "2026-10-03T12:00:00Z",
      },
    }, "io.scryapp.sub.starter.monthly"));
    expect(planInfo(result, at("2026-10-05T12:00:00Z"))).toMatchObject({ tier: "starter", hasBillingIssue: true });
    expect(planInfo(result, at("2026-10-10T12:00:00Z"))).toBeNull();
    expect(currentAllowance(result && { ...result, refundedAt: at("2026-10-04T12:00:00Z") }, at("2026-10-05T12:00:00Z"))).toBeNull();
  });
  it("reads the plan behind the swaps entitlement", () => {
    const result = subscriptionFromCustomer(
      USER,
      customer(
        {
          "io.scryapp.sub.pro.yearly": {
            purchase_date: "2026-10-03T12:00:00Z",
            expires_date: "2027-10-03T12:00:00Z",
            store: "rc_billing",
            unsubscribe_detected_at: "2026-10-05T00:00:00Z",
          },
        },
        "io.scryapp.sub.pro.yearly",
      ),
    );
    expect(result).toMatchObject({ tier: "pro", period: "yearly", store: "rc_billing", willRenew: false });
    expect(result?.periodStart).toEqual(at("2026-10-03T12:00:00Z"));
  });

  it("without an entitlement, keeps the known plan that expires last, and ignores old packs", () => {
    const result = subscriptionFromCustomer(
      USER,
      customer({
        "io.scryapp.credits.pro": { purchase_date: "2026-09-01T00:00:00Z", expires_date: null, store: "app_store" },
        "io.scryapp.sub.plus.monthly": { purchase_date: "2026-08-01T00:00:00Z", expires_date: "2026-09-01T00:00:00Z", store: "app_store" },
        "io.scryapp.sub.starter.monthly": { purchase_date: "2026-09-01T00:00:00Z", expires_date: "2026-10-01T00:00:00Z", store: "app_store" },
      }),
    );
    expect(result?.tier).toBe("starter");
  });

  it("ignores test purchases, unless the account is allowed to test", () => {
    const test = customer(
      { "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "app_store", is_sandbox: true } },
      "io.scryapp.sub.pro.monthly",
    );
    expect(subscriptionFromCustomer(USER, test)).toBeNull();
    expect(subscriptionFromCustomer(USER, test, { allowSandbox: true })?.tier).toBe("pro");
  });

  it("treats a purchase that isn't marked real as a test", () => {
    const unmarked: Customer = {
      subscriber: {
        entitlements: { swaps: { product_identifier: "io.scryapp.sub.pro.monthly" } },
        subscriptions: { "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "app_store" } },
      },
    };
    expect(subscriptionFromCustomer(USER, unmarked)).toBeNull();
  });

  it("a test purchase doesn't hide a real plan bought alongside it", () => {
    const both = customer(
      {
        "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "app_store", is_sandbox: true },
        "io.scryapp.sub.starter.monthly": { purchase_date: "2026-10-01T12:00:00Z", expires_date: "2026-11-01T12:00:00Z", store: "rc_billing" },
      },
      "io.scryapp.sub.pro.monthly",
    );
    expect(subscriptionFromCustomer(USER, both)?.tier).toBe("starter");
  });

  it("gives a promotional grant (App Review's demo account) the Starter plan", () => {
    const promo = customer(
      { rc_promo_swaps_monthly: { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "promotional" } },
      "rc_promo_swaps_monthly",
    );
    const result = subscriptionFromCustomer(USER, promo);
    expect(result).toMatchObject({ tier: "starter", period: "monthly", store: "promotional" });
    expect(currentAllowance(result, at("2026-10-10T00:00:00Z"))?.granted).toBe(25);
  });

  it("gives a lifetime promotional grant (no end date) no plan", () => {
    const lifetime = customer({ rc_promo_swaps_lifetime: { purchase_date: "2026-10-03T12:00:00Z", expires_date: null, store: "promotional" } });
    expect(subscriptionFromCustomer(USER, lifetime)).toBeNull();
  });

  it("is null when nothing bought is a plan", () => {
    expect(subscriptionFromCustomer(USER, customer({}))).toBeNull();
  });
});

describe("allowance", () => {
  const now = at("2026-10-10T00:00:00Z");

  it("gives the plan's swaps for the month that's running", () => {
    expect(currentAllowance(sub(), now)).toEqual({ monthStart: at("2026-10-03T12:00:00Z"), granted: 25 });
    expect(currentAllowance(null, now)).toBeNull();
  });

  it("gives nothing once the plan has ended", () => {
    expect(currentAllowance(sub({ expiresAt: at("2026-10-09T00:00:00Z") }), now)).toBeNull();
  });

  it("cancellation keeps access until the paid period ends, refunds end it immediately", () => {
    expect(planInfo(sub({ willRenew: false }), now)?.willRenew).toBe(false);
    expect(currentAllowance(sub({ refundedAt: now }), now)).toBeNull();
  });

  it("describes the plan for the app", () => {
    expect(planInfo(sub({ billingIssueAt: at("2026-10-04T00:00:00Z") }), now)).toEqual({
      tier: "starter",
      period: "monthly",
      swapsPerMonth: 25,
      monthStart: "2026-10-03T12:00:00.000Z",
      expiresAt: "2026-11-03T12:00:00.000Z",
      willRenew: true,
      hasBillingIssue: true,
      store: "app_store",
    });
    expect(planInfo(null, now)).toBeNull();
  });
});

describe("spending the monthly allowance", () => {
  const setup = (s: Subscription | null, now = at("2026-10-10T00:00:00Z")) => {
    const clock = { now };
    const subscriptions = createMemorySubscriptionStore(s ? [s] : []);
    const credits = createMemoryCreditStore({ [USER]: 99 }, { subscriptions, now: () => clock.now });
    return { credits, subscriptions, clock };
  };

  it("has nothing without a plan, whatever old credits the ledger holds (no free swap)", async () => {
    const { credits } = setup(null);
    expect(await credits.balance(USER)).toBe(0);
    expect(await credits.spend(USER)).toBeNull();
  });

  it("spends down to zero, then refuses", async () => {
    const { credits } = setup(sub());
    for (let i = 0; i < 25; i++) expect(await credits.spend(USER)).not.toBeNull();
    expect(await credits.balance(USER)).toBe(0);
    expect(await credits.spend(USER)).toBeNull();
  });

  it("gives a refunded swap back to the month it came from, once", async () => {
    const { credits } = setup(sub());
    const entry = (await credits.spend(USER))!;
    expect(await credits.balance(USER)).toBe(24);
    await credits.refundEntry(entry);
    await credits.refundEntry(entry);
    expect(await credits.balance(USER)).toBe(25);
  });

  it("doesn't roll over: a new month starts full, last month's leftovers are gone", async () => {
    const { credits, subscriptions, clock } = setup(sub({ period: "yearly", productId: "io.scryapp.sub.starter.yearly", expiresAt: at("2027-10-03T12:00:00Z") }));
    await credits.spend(USER);
    expect(await credits.balance(USER)).toBe(24);
    clock.now = at("2026-11-05T00:00:00Z");
    expect(await credits.balance(USER)).toBe(25);
    expect((await subscriptions.get(USER))?.period).toBe("yearly");
  });

  it("starts a fresh month when an upgrade starts a new billing period (owner's choice)", async () => {
    const { credits, subscriptions } = setup(sub());
    for (let i = 0; i < 20; i++) await credits.spend(USER);
    // What RevenueCat reports after an Apple upgrade: the old plan ends, the new one starts now.
    const upgraded = subscriptionFromCustomer(USER, customer(
      {
        "io.scryapp.sub.starter.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-10-10T00:00:00Z", store: "app_store" },
        "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-10T00:00:00Z", expires_date: "2026-11-10T00:00:00Z", store: "app_store" },
      },
      "io.scryapp.sub.pro.monthly",
    ));
    await subscriptions.save(upgraded!);
    expect(await credits.balance(USER)).toBe(150);
  });

  it("a bigger plan in the same billing period raises this month's swaps, keeping what was used", async () => {
    const { credits, subscriptions } = setup(sub());
    for (let i = 0; i < 20; i++) await credits.spend(USER);
    await subscriptions.save(sub({ productId: "io.scryapp.sub.pro.monthly", tier: "pro" }));
    expect(await credits.balance(USER)).toBe(130);
  });
});

describe("RevenueCat webhook", () => {
  const SECRET = "Bearer a-long-random-value";
  const event = (e: Record<string, unknown>) => ({ event: { id: "evt_1", type: "RENEWAL", ...e } });
  const api = (byUser: Record<string, Customer>): RevenueCatApi & { customer: ReturnType<typeof vi.fn> } => ({
    customer: vi.fn(async (id: string) => byUser[id] ?? customer({})),
  });
  const pro = customer(
    { "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "app_store" } },
    "io.scryapp.sub.pro.monthly",
  );

  it("checks the Authorization header exactly", () => {
    expect(isWebhookAuthorized(SECRET, SECRET)).toBe(true);
    expect(isWebhookAuthorized("Bearer wrong", SECRET)).toBe(false);
    expect(isWebhookAuthorized(null, SECRET)).toBe(false);
    expect(isWebhookAuthorized(SECRET, undefined)).toBe(false);
  });

  it("refuses when not set up or not authorized, without reading RevenueCat", async () => {
    const store = createMemorySubscriptionStore();
    const rc = api({});
    expect((await handleWebhook({ authorization: SECRET, body: event({ app_user_id: USER }) }, { secret: "", api: rc, store })).status).toBe(503);
    expect((await handleWebhook({ authorization: "nope", body: event({ app_user_id: USER }) }, { secret: SECRET, api: rc, store })).status).toBe(401);
    expect(rc.customer).not.toHaveBeenCalled();
  });

  it("saves what RevenueCat says now, for any event type", async () => {
    const store = createMemorySubscriptionStore();
    const result = await handleWebhook(
      { authorization: SECRET, body: event({ type: "SOME_NEW_TYPE", app_user_id: USER }) },
      { secret: SECRET, api: api({ [USER]: pro }), store },
    );
    expect(result.status).toBe(200);
    expect((await store.get(USER))?.tier).toBe("pro");
  });

  it("ignores ids that aren't our accounts", async () => {
    const rc = api({});
    const result = await handleWebhook(
      { authorization: SECRET, body: event({ app_user_id: "$RCAnonymousID:abc" }) },
      { secret: SECRET, api: rc, store: createMemorySubscriptionStore() },
    );
    expect(result).toEqual({ status: 200, body: "No account" });
    expect(rc.customer).not.toHaveBeenCalled();
  });

  it("on a transfer, updates both accounts: the plan moves and the old one loses it", async () => {
    const store = createMemorySubscriptionStore([sub({ userId: OTHER })]);
    await handleWebhook(
      { authorization: SECRET, body: event({ type: "TRANSFER", transferred_from: [OTHER], transferred_to: [USER] }) },
      { secret: SECRET, api: api({ [USER]: pro }), store },
    );
    expect((await store.get(USER))?.tier).toBe("pro");
    expect(await store.get(OTHER)).toBeNull();
  });

  it("gives a test purchase a plan only for accounts on the allow-list", async () => {
    const test = customer(
      { "io.scryapp.sub.pro.monthly": { purchase_date: "2026-10-03T12:00:00Z", expires_date: "2026-11-03T12:00:00Z", store: "app_store", is_sandbox: true } },
      "io.scryapp.sub.pro.monthly",
    );
    const store = createMemorySubscriptionStore([sub({ userId: OTHER })]);
    const body = event({ type: "TRANSFER", transferred_from: [OTHER], transferred_to: [USER] });
    await handleWebhook(
      { authorization: SECRET, body },
      { secret: SECRET, api: api({ [USER]: test, [OTHER]: test }), store, sandboxAccounts: new Set([USER]) },
    );
    expect((await store.get(USER))?.tier).toBe("pro");
    expect(await store.get(OTHER)).toBeNull();
  });

  it("skips deleted accounts without reading RevenueCat", async () => {
    const rc = api({ [USER]: pro });
    const store = createMemorySubscriptionStore();
    const result = await handleWebhook(
      { authorization: SECRET, body: event({ app_user_id: USER }) },
      { secret: SECRET, api: rc, store, accountExists: async () => false },
    );
    expect(result.status).toBe(200);
    expect(rc.customer).not.toHaveBeenCalled();
    expect(await store.get(USER)).toBeNull();
  });

  it("is retried when it can't tell whether the account exists", async () => {
    const run = handleWebhook(
      { authorization: SECRET, body: event({ app_user_id: USER }) },
      { secret: SECRET, api: api({ [USER]: pro }), store: createMemorySubscriptionStore(), accountExists: async () => Promise.reject(new Error("db down")) },
    );
    await expect(run).rejects.toThrow("db down");
  });

  it("rejects a body that isn't an event", async () => {
    const result = await handleWebhook({ authorization: SECRET, body: { hello: 1 } }, { secret: SECRET, api: api({}), store: createMemorySubscriptionStore() });
    expect(result.status).toBe(400);
  });
});

describe("sandbox allow-list", () => {
  it("reads account ids from REVENUECAT_SANDBOX_ACCOUNTS, ignoring anything that isn't one", () => {
    const ids = sandboxAccountsFromEnv({ REVENUECAT_SANDBOX_ACCOUNTS: ` ${USER.toUpperCase()}, nope,${OTHER} ` });
    expect([...ids].sort()).toEqual([OTHER, USER].sort());
    expect(sandboxAccountsFromEnv({}).size).toBe(0);
  });
});

describe("RevenueCat customer delete", () => {
  const reply = (status: number) => vi.fn(async () => new Response(null, { status }));

  it("deletes the customer with the secret key", async () => {
    const doFetch = reply(200);
    await revenueCatApiFromEnv({ REVENUECAT_SECRET_API_KEY: "test-only-key" }, doFetch).deleteCustomer(USER);
    expect(doFetch).toHaveBeenCalledWith(
      `https://api.revenuecat.com/v1/subscribers/${USER}`,
      expect.objectContaining({ method: "DELETE", headers: { Authorization: "Bearer test-only-key" } }),
    );
  });

  it("counts a customer RevenueCat never had as deleted", async () => {
    await expect(revenueCatApiFromEnv({ REVENUECAT_SECRET_API_KEY: "test-only-key" }, reply(404)).deleteCustomer(USER)).resolves.toBeUndefined();
  });

  it("throws when RevenueCat fails or the key is missing, so nothing else is deleted", async () => {
    await expect(revenueCatApiFromEnv({ REVENUECAT_SECRET_API_KEY: "test-only-key" }, reply(500)).deleteCustomer(USER)).rejects.toThrow(/500/);
    await expect(revenueCatApiFromEnv({}, reply(200)).deleteCustomer(USER)).rejects.toThrow(/isn't set/);
  });
});
