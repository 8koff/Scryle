import { describe, expect, it } from "vitest";
import type { Product } from "@/lib/catalog/catalog";
import { addItem, MAX_QTY, parseCart, setQty, summarize } from "./cart";

// Test data only: never shown in the app.
const item = (id: string, store: string, priceCents: number): Product => ({
  id,
  pack: "room",
  part: "sofa",
  title: `Test ${id}`,
  kind: "catalog",
  priceCents,
  store,
  buyUrl: `https://store.test/${id}`,
  image: `https://store.test/${id}.jpg`,
});

const catalog: Record<string, Product> = {
  a: item("a", "Store One", 1000),
  b: item("b", "Store Two", 2500),
  c: item("c", "Store One", 499),
  sample: { id: "sample", pack: "room", part: "sofa", title: "Sample sofa", kind: "sample", image: "/demo/x.jpg" },
};
const find = (id: string) => catalog[id];

describe("cart", () => {
  it("adds products and counts repeats", () => {
    let cart = addItem([], find("a"));
    cart = addItem(cart, find("a"));
    cart = addItem(cart, find("b"));
    expect(cart).toEqual([
      { productId: "a", qty: 2 },
      { productId: "b", qty: 1 },
    ]);
  });

  it("never adds samples or unknown products", () => {
    expect(addItem([], find("sample"))).toEqual([]);
    expect(addItem([], undefined)).toEqual([]);
  });

  it("doesn't change the cart it was given", () => {
    const cart = [{ productId: "a", qty: 1 }];
    addItem(cart, find("a"));
    setQty(cart, "a", 5);
    expect(cart).toEqual([{ productId: "a", qty: 1 }]);
  });

  it("sets amounts, caps them, and removes at zero", () => {
    const cart = [{ productId: "a", qty: 1 }];
    expect(setQty(cart, "a", 3)).toEqual([{ productId: "a", qty: 3 }]);
    expect(setQty(cart, "a", 999)).toEqual([{ productId: "a", qty: MAX_QTY }]);
    expect(setQty(cart, "a", 0)).toEqual([]);
  });

  it("groups by store with subtotals and a total", () => {
    const summary = summarize(
      [
        { productId: "a", qty: 2 },
        { productId: "b", qty: 1 },
        { productId: "c", qty: 1 },
      ],
      find,
    );
    expect(summary.groups.map((g) => [g.store, g.subtotalCents])).toEqual([
      ["Store One", 2499],
      ["Store Two", 2500],
    ]);
    expect(summary.totalCents).toBe(4999);
    expect(summary.count).toBe(4);
  });

  it("leaves out products that are no longer for sale", () => {
    const summary = summarize(
      [
        { productId: "gone", qty: 1 },
        { productId: "sample", qty: 1 },
        { productId: "a", qty: 1 },
      ],
      find,
    );
    expect(summary.count).toBe(1);
    expect(summary.totalCents).toBe(1000);
  });

  it("reads a saved cart safely", () => {
    expect(parseCart('[{"productId":"a","qty":2},{"productId":5},{"nope":true}]')).toEqual([{ productId: "a", qty: 2 }]);
    expect(parseCart("not json")).toEqual([]);
    expect(parseCart('{"productId":"a"}')).toEqual([]);
    expect(parseCart(null)).toEqual([]);
  });
});
