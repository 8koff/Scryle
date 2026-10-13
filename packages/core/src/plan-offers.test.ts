import { describe, expect, test } from "vitest";
import { isPreview, offersFromPackages, previewOffers } from "./plan-offers";

const pkg = (identifier: string, priceString = "$1.00") => ({ identifier: `$rc_${identifier}`, product: { identifier, priceString } });

describe("offersFromPackages", () => {
  test("keeps only our plans, in paywall order, with the store's own prices", () => {
    const offers = offersFromPackages([
      pkg("io.scryapp.sub.pro.yearly", "$199.99"),
      pkg("io.scryapp.credits.pro"),
      pkg("io.scryapp.sub.starter.monthly", "4,99 €"),
      pkg("io.scryapp.sub.pro.monthly", "$19.99"),
    ]);
    expect(offers.map((o) => [o.tier.id, o.period, o.priceString])).toEqual([
      ["starter", "monthly", "4,99 €"],
      ["pro", "monthly", "$19.99"],
      ["pro", "yearly", "$199.99"],
    ]);
    expect(offers.every((o) => !isPreview(o))).toBe(true);
  });

  test("shows a product once even if the dashboard lists it twice", () => {
    expect(offersFromPackages([pkg("io.scryapp.sub.plus.monthly"), pkg("io.scryapp.sub.plus.monthly")])).toHaveLength(1);
  });
});

describe("previewOffers", () => {
  test("all six plans at the website's prices, none of them buyable", () => {
    const offers = previewOffers();
    expect(offers).toHaveLength(6);
    expect(offers.find((o) => o.tier.id === "plus" && o.period === "yearly")?.priceString).toBe("$99.99");
    expect(offers.every(isPreview)).toBe(true);
  });
});
