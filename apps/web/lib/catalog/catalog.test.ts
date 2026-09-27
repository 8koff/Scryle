import { describe, expect, it } from "vitest";
import catalogFile from "./products.json";
import { loadCatalog } from "./catalog";

const good = {
  id: "room-sofa-test",
  pack: "room",
  part: "sofa",
  title: "Test sofa",
  priceCents: 49900,
  store: "Store",
  buyUrl: "https://store.test/sofa",
  image: "https://store.test/sofa.jpg",
};

describe("loadCatalog", () => {
  it("accepts the shipped products.json", () => {
    expect(() => loadCatalog(catalogFile)).not.toThrow();
  });

  it("marks products as real catalog items", () => {
    expect(loadCatalog([good])[0]).toMatchObject({ id: "room-sofa-test", kind: "catalog", priceCents: 49900 });
  });

  it("refuses entries with a missing price, a non-https link or an unknown category", () => {
    expect(() => loadCatalog([{ ...good, priceCents: undefined }])).toThrow(/products.json is invalid/);
    expect(() => loadCatalog([{ ...good, buyUrl: "http://store.test/sofa" }])).toThrow(/products.json is invalid/);
    expect(() => loadCatalog([{ ...good, pack: "boats" }])).toThrow(/products.json is invalid/);
  });

  it("refuses the same id twice", () => {
    expect(() => loadCatalog([good, good])).toThrow(/twice/);
  });
});
