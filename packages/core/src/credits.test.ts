import { describe, expect, it } from "vitest";
import { CREDIT_PACKS, creditPack, formatUsd, FREE_RENDERS, isCreditPackId, packMargin } from "./credits";

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
});

describe("formatUsd", () => {
  it("shows two decimals and commas for thousands", () => {
    expect(formatUsd(499)).toBe("$4.99");
    expect(formatUsd(279999)).toBe("$2,799.99");
    expect(formatUsd(100000000)).toBe("$1,000,000.00");
  });
});
