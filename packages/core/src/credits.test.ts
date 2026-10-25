import { describe, expect, it } from "vitest";
import {
  appleProductId,
  CREDIT_PACKS,
  creditPack,
  creditPackForAppleProduct,
  formatUsd,
  FREE_RENDERS,
  isCreditPackId,
  packMargin,
  packSavingPercent,
} from "./credits";

describe("credit packs", () => {
  it("gives every new account exactly one free render", () => {
    expect(FREE_RENDERS).toBe(1);
  });

  it("finds packs by id and rejects unknown ids", () => {
    expect(creditPack("starter")?.credits).toBeGreaterThan(0);
    expect(isCreditPackId("starter")).toBe(true);
    expect(isCreditPackId("free-lunch")).toBe(false);
    expect(creditPack("free-lunch")).toBeUndefined();
  });

  it("makes each bigger pack cheaper per render", () => {
    const perRender = CREDIT_PACKS.map((p) => p.priceCents / p.credits);
    perRender.slice(1).forEach((cost, i) => expect(cost).toBeLessThan(perRender[i]!));
  });

  it("points people to exactly one best-value pack", () => {
    expect(CREDIT_PACKS.filter((p) => p.isBestValue)).toHaveLength(1);
  });

  it("keeps at least 60% margin after Stripe fees at a 4-cent render cost", () => {
    for (const pack of CREDIT_PACKS) {
      expect(packMargin(pack, 4)).toBeGreaterThanOrEqual(0.6);
    }
  });

  // Same prices on iOS (owner's choice, 2026-09-28): Apple's 15% leaves less, so the bar is lower.
  it("keeps at least 50% margin after Apple's 15% at a 4-cent render cost", () => {
    for (const pack of CREDIT_PACKS) {
      expect(packMargin(pack, 4, "apple")).toBeGreaterThanOrEqual(0.5);
    }
  });
});

describe("Apple products", () => {
  it("maps each pack to one App Store product id and back", () => {
    for (const pack of CREDIT_PACKS) {
      expect(appleProductId(pack)).toBe(`io.scryapp.credits.${pack.id}`);
      expect(creditPackForAppleProduct(appleProductId(pack))).toBe(pack);
    }
  });

  it("rejects ids from anything else", () => {
    expect(creditPackForAppleProduct("io.scryapp.credits.free-lunch")).toBeUndefined();
    expect(creditPackForAppleProduct("com.other.app.credits.starter")).toBeUndefined();
    expect(creditPackForAppleProduct("starter")).toBeUndefined();
  });
});

describe("packSavingPercent", () => {
  it("rounds the saving down against the smallest pack", () => {
    expect(CREDIT_PACKS.map(packSavingPercent)).toEqual([0, 16, 33]);
  });
});

describe("formatUsd", () => {
  it("shows two decimals and commas for thousands", () => {
    expect(formatUsd(499)).toBe("$4.99");
    expect(formatUsd(279999)).toBe("$2,799.99");
    expect(formatUsd(100000000)).toBe("$1,000,000.00");
  });
});
