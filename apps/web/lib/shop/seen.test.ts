import { describe, expect, it } from "vitest";
import { summarize } from "./cart";
import { isTrustedImage, parseLiveProduct, type LiveProduct } from "./live";
import { createSeenStore } from "./seen";

const product = (id: string, priceCents = 1000): LiveProduct => ({
  id,
  pack: "room",
  part: "sofa",
  kind: "live",
  title: "Oak sofa",
  priceCents,
  store: "IKEA",
  image: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:x",
});

const ID_A = `live-${"a".repeat(20)}`;
const ID_B = `live-${"b".repeat(20)}`;

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("createSeenStore", () => {
  it("remembers found products and updates their price when seen again", () => {
    const storage = memoryStorage();
    const seen = createSeenStore(() => storage);
    seen.remember([product(ID_A), product(ID_B)]);
    seen.remember([product(ID_A, 2000)]);
    expect(seen.get(ID_A)?.priceCents).toBe(2000);
    expect(seen.get(ID_B)?.priceCents).toBe(1000);
  });

  it("ignores anything odd in storage", () => {
    const storage = memoryStorage();
    storage.setItem("retrofit:shop-seen", JSON.stringify([{ ...product(ID_A), image: "https://evil.example/x.jpg" }, "junk"]));
    expect(createSeenStore(() => storage).get(ID_A)).toBeUndefined();
    storage.setItem("retrofit:shop-seen", "{not json");
    expect(createSeenStore(() => storage).get(ID_A)).toBeUndefined();
  });

  it("works with no storage at all", () => {
    const seen = createSeenStore(() => null);
    seen.remember([product(ID_A)]);
    expect(seen.get(ID_A)).toBeUndefined();
  });
});

describe("found products in the cart", () => {
  it("are grouped by store like catalog products", () => {
    const summary = summarize([{ productId: ID_A, qty: 2 }], (id) => (id === ID_A ? product(ID_A) : undefined));
    expect(summary).toMatchObject({ totalCents: 2000, count: 2, groups: [{ store: "IKEA" }] });
  });
});

describe("parseLiveProduct / isTrustedImage", () => {
  it("accepts only Google and SerpApi product photos", () => {
    expect(isTrustedImage("https://encrypted-tbn3.gstatic.com/shopping?q=1")).toBe(true);
    expect(isTrustedImage("https://serpapi.com/images/url/1")).toBe(true);
    expect(isTrustedImage("http://encrypted-tbn3.gstatic.com/x")).toBe(false);
    expect(isTrustedImage("https://encrypted-tbn3.gstatic.com.evil.example/x")).toBe(false);
    expect(isTrustedImage("https://169.254.169.254/latest")).toBe(false);
  });

  it("rejects bad ids and unknown packs", () => {
    expect(parseLiveProduct(product("sample-bomber"))).toBeNull();
    expect(parseLiveProduct({ ...product(ID_A), pack: "boat" })).toBeNull();
    expect(parseLiveProduct(product(ID_A))).toEqual(product(ID_A));
  });
});
