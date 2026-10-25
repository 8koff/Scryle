import { describe, expect, it } from "vitest";
import {
  addMonthsUtc,
  allowanceMonthStart,
  getPlanTier,
  PLAN_TIERS,
  planBilling,
  planForProduct,
  subscriptionProductId,
  yearlySavingPercent,
} from "./subscriptions";

const at = (iso: string) => new Date(iso);

describe("plans", () => {
  it("keeps the owner's prices and allowances", () => {
    expect(PLAN_TIERS.map((t) => [t.id, t.swapsPerMonth, t.monthlyCents, t.yearlyCents])).toEqual([
      ["starter", 25, 499, 4999],
      ["plus", 60, 999, 9999],
      ["pro", 150, 1999, 19999],
    ]);
  });

  it("maps every product id back to its plan, and nothing else", () => {
    for (const tier of PLAN_TIERS) {
      for (const period of ["monthly", "yearly"] as const) {
        expect(planForProduct(subscriptionProductId(tier.id, period))).toEqual({ tier, period });
      }
    }
    expect(planForProduct("io.scryapp.credits.pro")).toBeUndefined();
    expect(planForProduct("io.scryapp.sub.pro.weekly")).toBeUndefined();
    expect(planForProduct("io.scryapp.sub.gold.monthly")).toBeUndefined();
    expect(planForProduct("io.scryapp.sub.pro.monthly.extra")).toBeUndefined();
  });

  it("says yearly saves about two months, rounded down", () => {
    expect(PLAN_TIERS.map(yearlySavingPercent)).toEqual([16, 16, 16]);
    expect(getPlanTier("pro")?.isBestValue).toBe(true);
  });
});

describe("allowance months", () => {
  it("clamps to the end of short months, like store billing", () => {
    expect(addMonthsUtc(at("2026-01-31T10:00:00Z"), 1).toISOString()).toBe("2026-02-28T10:00:00.000Z");
    expect(addMonthsUtc(at("2028-01-31T10:00:00Z"), 1).toISOString()).toBe("2028-02-29T10:00:00.000Z");
    expect(addMonthsUtc(at("2026-11-15T00:00:00Z"), 3).toISOString()).toBe("2027-02-15T00:00:00.000Z");
  });

  it("is the billing period's start during its first month", () => {
    const anchor = at("2026-10-03T12:00:00Z");
    expect(allowanceMonthStart(anchor, at("2026-10-03T12:00:00Z"))).toEqual(anchor);
    expect(allowanceMonthStart(anchor, at("2026-11-03T11:59:59Z"))).toEqual(anchor);
  });

  it("moves on exactly one calendar month later (a yearly plan gets twelve)", () => {
    const anchor = at("2026-10-03T12:00:00Z");
    expect(allowanceMonthStart(anchor, at("2026-11-03T12:00:00Z")).toISOString()).toBe("2026-11-03T12:00:00.000Z");
    expect(allowanceMonthStart(anchor, at("2027-09-20T00:00:00Z")).toISOString()).toBe("2027-09-03T12:00:00.000Z");
  });

  it("handles an anchor on the 31st across short months", () => {
    const anchor = at("2026-01-31T08:00:00Z");
    expect(allowanceMonthStart(anchor, at("2026-03-01T00:00:00Z")).toISOString()).toBe("2026-02-28T08:00:00.000Z");
    expect(allowanceMonthStart(anchor, at("2026-03-31T09:00:00Z")).toISOString()).toBe("2026-03-31T08:00:00.000Z");
  });

  it("never returns a start before the anchor, even with a clock that's behind", () => {
    const anchor = at("2026-10-03T12:00:00Z");
    expect(allowanceMonthStart(anchor, at("2026-10-01T00:00:00Z"))).toEqual(anchor);
  });
});

describe("planBilling", () => {
  it("says who bills a plan, so nobody is sold a second one", () => {
    expect(planBilling({ store: "app_store" })).toBe("apple");
    expect(planBilling({ store: "rc_billing" })).toBe("web");
    expect(planBilling({ store: "stripe" })).toBe("web");
    expect(planBilling({ store: "promotional" })).toBeNull();
    expect(planBilling(null)).toBeNull();
  });
});
