import { describe, expect, it, vi } from "vitest";
import { signPhoto, type PhotoClaim } from "../signing";
import { resolveStoreLink, pickOffer } from "./go";
import { createMemoryShopStore, liveProductId, toStored } from "./products";
import { handleShopSearch, SEARCH_TTL_MS, type ShopSearchDeps } from "./search";
import { SerpApiError, type SerpApi, type ShoppingHit } from "./serpapi";

const SECRET = "shop-test-secret-with-enough-length-x";

const claim: PhotoClaim = {
  photoUrl: "https://cdn/room.jpg",
  pack: "room",
  width: 1600,
  height: 1200,
  scene: { subject: "a living room", parts: [{ partId: "sofa", label: "Sofa", current: "grey sofa", box: { x: 0.1, y: 0.4, w: 0.6, h: 0.4 } }] },
};

const hit = (title: string, store = "West Elm", priceCents = 99900): ShoppingHit => ({
  title,
  priceCents,
  store,
  image: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:a",
  googleLink: "https://www.google.com/search?ibp=oshop&prds=1",
  offerToken: "tok",
});

function fakeApi(hits: ShoppingHit[] = [hit("Emerald velvet sofa"), hit("Oak sofa", "IKEA", 49900)]) {
  return {
    search: vi.fn(async () => hits),
    offers: vi.fn(async () => [{ name: "West Elm", link: "https://www.westelm.com/p/1" }]),
  } satisfies SerpApi;
}

function deps(overrides: Partial<ShopSearchDeps> = {}): ShopSearchDeps {
  return { secret: SECRET, store: createMemoryShopStore(), api: fakeApi(), takeSearch: vi.fn(async () => true), ...overrides };
}

const request = (extra: Record<string, unknown> = {}, c: PhotoClaim = claim) => ({ claim: c, token: signPhoto(c, SECRET), partId: "sofa", ...extra });

describe("handleShopSearch", () => {
  it("finds products for a part and hides the store links from the browser", async () => {
    const d = deps();
    const result = await handleShopSearch(request({ words: "green velvet" }), d);

    expect(result.status).toBe(200);
    expect(d.api?.search).toHaveBeenCalledWith("green velvet sofa");
    if (!result.body.success) throw new Error("expected success");
    expect(result.body.data.products).toHaveLength(2);
    expect(result.body.data.products[0]).toEqual({
      id: liveProductId("room", "sofa", hit("Emerald velvet sofa")),
      pack: "room",
      part: "sofa",
      kind: "live",
      title: "Emerald velvet sofa",
      priceCents: 99900,
      store: "West Elm",
      image: "https://encrypted-tbn1.gstatic.com/shopping?q=tbn:a",
    });
    expect(JSON.stringify(result.body)).not.toContain("google.com");
  });

  it("answers the same search from the saved results, without using the budget", async () => {
    const d = deps();
    await handleShopSearch(request(), d);
    await handleShopSearch(request(), d);
    expect(d.api?.search).toHaveBeenCalledTimes(1);
    expect(d.takeSearch).toHaveBeenCalledTimes(1);
  });

  it("shares one store search between identical requests made at the same time", async () => {
    const d = deps();
    const [a, b] = await Promise.all([handleShopSearch(request(), d), handleShopSearch(request(), d)]);
    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(d.api?.search).toHaveBeenCalledTimes(1);
    expect(d.takeSearch).toHaveBeenCalledTimes(1);
  });

  it("doesn't spend a search when the saved searches can't be read", async () => {
    const store = { ...createMemoryShopStore(), getSearch: vi.fn(async () => Promise.reject(new Error("no table"))) };
    const d = deps({ store });
    expect((await handleShopSearch(request(), d)).status).toBe(502);
    expect(d.takeSearch).not.toHaveBeenCalled();
  });

  it("searches again once the saved results are a day old", async () => {
    let now = 0;
    const d = deps({ store: createMemoryShopStore(() => now) });
    await handleShopSearch(request(), d);
    now = SEARCH_TTL_MS + 1;
    await handleShopSearch(request(), d);
    expect(d.api?.search).toHaveBeenCalledTimes(2);
  });

  it("stops when today's budget is used up", async () => {
    const d = deps({ takeSearch: vi.fn(async () => false) });
    const result = await handleShopSearch(request(), d);
    expect(result.status).toBe(503);
    expect(d.api?.search).not.toHaveBeenCalled();
  });

  it("refuses a photo that wasn't signed by us", async () => {
    const d = deps();
    const result = await handleShopSearch({ ...request(), token: "1.bad" }, d);
    expect(result.status).toBe(403);
    expect(d.takeSearch).not.toHaveBeenCalled();
  });

  it("refuses colour-only parts and parts that aren't in the pack or photo", async () => {
    expect((await handleShopSearch(request({ partId: "wall-colour" }), deps())).status).toBe(400);
    expect((await handleShopSearch(request({ partId: "rocket" }), deps())).status).toBe(400);
  });

  it("hides swimwear and underwear from clothing results", async () => {
    const person: PhotoClaim = {
      ...claim,
      pack: "clothing",
      scene: { subject: "a person", parts: [{ partId: "top", label: "T-shirt", current: "white tee", box: { x: 0.2, y: 0.2, w: 0.5, h: 0.3 } }] },
    };
    const d = deps({ api: fakeApi([hit("Linen shirt"), hit("Triangle bikini top"), hit("Lace bralette")]) });
    const result = await handleShopSearch(request({ partId: "top" }, person), d);
    if (!result.body.success) throw new Error("expected success");
    expect(result.body.data.products.map((p) => p.title)).toEqual(["Linen shirt"]);
  });

  it("says so when search isn't set up or the store search fails", async () => {
    expect((await handleShopSearch(request(), deps({ api: null }))).status).toBe(503);
    const broken = { search: vi.fn(async () => Promise.reject(new Error("down"))), offers: vi.fn() } as unknown as SerpApi;
    expect((await handleShopSearch(request(), deps({ api: broken }))).status).toBe(502);
  });
});

describe("resolveStoreLink", () => {
  const product = toStored("room", "sofa", hit("Emerald velvet sofa"));

  it("looks up the store's own page once, then keeps it", async () => {
    const store = createMemoryShopStore();
    await store.saveSearch("k", [product]);
    const api = fakeApi();
    const d = { store, api, takeSearch: vi.fn(async () => true) };

    expect(await resolveStoreLink(product, d)).toEqual({ url: "https://www.westelm.com/p/1", isStore: true });
    const [saved] = await store.getMany([product.id]);
    expect(await resolveStoreLink(saved!, d)).toEqual({ url: "https://www.westelm.com/p/1", isStore: true });
    expect(api.offers).toHaveBeenCalledTimes(1);
  });

  it("keeps the store link when a new search refreshes the product", async () => {
    const store = createMemoryShopStore();
    await store.saveSearch("k", [product]);
    await store.setStoreUrl(product.id, "https://www.westelm.com/p/1");
    await store.saveSearch("k2", [{ ...product, priceCents: 1 }]);
    expect((await store.getMany([product.id]))[0]).toMatchObject({ priceCents: 1, storeUrl: "https://www.westelm.com/p/1" });
  });

  it("remembers when Google has no store list, so the next tap doesn't search again", async () => {
    const store = createMemoryShopStore();
    await store.saveSearch("k", [product]);
    const api = { search: vi.fn(), offers: vi.fn(async () => Promise.reject(new SerpApiError("no results"))) } as unknown as SerpApi;
    const d = { store, api, takeSearch: vi.fn(async () => true) };

    expect(await resolveStoreLink(product, d)).toEqual({ url: product.googleLink, isStore: false });
    const [saved] = await store.getMany([product.id]);
    expect(await resolveStoreLink(saved!, d)).toEqual({ url: product.googleLink, isStore: false });
    expect(api.offers).toHaveBeenCalledTimes(1);
  });

  it("tries again later after a network error", async () => {
    const store = createMemoryShopStore();
    await store.saveSearch("k", [product]);
    const api = { search: vi.fn(), offers: vi.fn(async () => Promise.reject(new TypeError("fetch failed"))) } as unknown as SerpApi;
    await resolveStoreLink(product, { store, api, takeSearch: async () => true });
    expect((await store.getMany([product.id]))[0]?.storeUrl).toBeUndefined();
  });

  it("shares one lookup between two taps on Buy at the same time", async () => {
    const store = createMemoryShopStore();
    const api = fakeApi();
    const d = { store, api, takeSearch: vi.fn(async () => true) };
    await Promise.all([resolveStoreLink(product, d), resolveStoreLink(product, d)]);
    expect(api.offers).toHaveBeenCalledTimes(1);
  });

  it("falls back to Google's page when the budget is used up or the lookup fails", async () => {
    const store = createMemoryShopStore();
    expect(await resolveStoreLink(product, { store, api: fakeApi(), takeSearch: async () => false })).toEqual({ url: product.googleLink, isStore: false });
    const broken = { search: vi.fn(), offers: vi.fn(async () => Promise.reject(new Error("down"))) } as unknown as SerpApi;
    expect(await resolveStoreLink(product, { store, api: broken, takeSearch: async () => true })).toEqual({ url: product.googleLink, isStore: false });
  });
});

describe("pickOffer", () => {
  it("prefers the store the search showed, ignoring case and spacing", () => {
    const offers = [
      { name: "Wayfair", link: "https://www.wayfair.com/1" },
      { name: "west elm", link: "https://www.westelm.com/1" },
    ];
    expect(pickOffer(offers, "West Elm")?.link).toBe("https://www.westelm.com/1");
    expect(pickOffer(offers, "Target")?.link).toBe("https://www.wayfair.com/1");
    expect(pickOffer([], "Target")).toBeUndefined();
  });
});
