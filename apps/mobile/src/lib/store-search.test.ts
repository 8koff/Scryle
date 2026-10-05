import type { Build } from "./builds";
import { parseLiveProduct, searchStore } from "./store-search";

const mockPostJson = jest.fn();
jest.mock("./api", () => ({ postJson: (...args: unknown[]) => mockPostJson(...args), getApi: jest.fn() }));

const good = {
  id: "live-0123456789abcdef0123",
  pack: "room",
  part: "sofa",
  title: "Green velvet sofa",
  priceCents: 79999,
  store: "Example Store",
  image: "https://encrypted-tbn0.gstatic.com/images?q=1",
};

let buildCount = 0;
const newBuild = (): Build =>
  ({
    id: `b${++buildCount}`,
    pack: "room",
    localUri: "file:///photo.jpg",
    photoUrl: "https://cdn.test/photo.jpg",
    width: 3,
    height: 4,
    scene: { subject: "a room", parts: [] },
    token: "signed",
  }) as Build;

describe("parseLiveProduct", () => {
  test("keeps a well-formed product", () => {
    expect(parseLiveProduct(good)).toEqual(good);
  });

  test("drops products with a bad id, pack, price or picture", () => {
    expect(parseLiveProduct({ ...good, id: "sample-sofa" })).toBeNull();
    expect(parseLiveProduct({ ...good, pack: "boats" })).toBeNull();
    expect(parseLiveProduct({ ...good, priceCents: 0 })).toBeNull();
    expect(parseLiveProduct({ ...good, priceCents: 9.5 })).toBeNull();
    expect(parseLiveProduct({ ...good, image: "http://example.test/a.jpg" })).toBeNull();
    expect(parseLiveProduct({ ...good, title: "" })).toBeNull();
    expect(parseLiveProduct(null)).toBeNull();
  });
});

// Each new store search costs money, so these guards matter.
describe("searchStore", () => {
  beforeEach(() => mockPostJson.mockReset());

  test("sends the signed photo and keeps the answer, so asking again is free", async () => {
    const build = newBuild();
    mockPostJson.mockResolvedValueOnce({ status: "ready", data: { products: [good] } });

    const first = await searchStore(build, "sofa", undefined);
    const second = await searchStore(build, "sofa", undefined);

    expect(first).toEqual({ status: "ready", products: [good] });
    expect(second).toEqual(first);
    expect(mockPostJson).toHaveBeenCalledTimes(1);
    expect(mockPostJson).toHaveBeenCalledWith("/api/shop/search", {
      claim: { photoUrl: build.photoUrl, pack: "room", width: 3, height: 4, scene: build.scene },
      token: "signed",
      partId: "sofa",
    });
  });

  test("two searches at the same time share one request", async () => {
    const build = newBuild();
    mockPostJson.mockResolvedValueOnce({ status: "ready", data: { products: [] } });

    await Promise.all([searchStore(build, "rug", undefined), searchStore(build, "rug", undefined)]);

    expect(mockPostJson).toHaveBeenCalledTimes(1);
  });

  test("an error isn't kept, so the next visit tries again", async () => {
    const build = newBuild();
    mockPostJson.mockResolvedValueOnce({ status: "error", message: "Today's searches are used up." });
    mockPostJson.mockResolvedValueOnce({ status: "ready", data: { products: [good] } });

    expect(await searchStore(build, "lamp", undefined)).toEqual({ status: "error", message: "Today's searches are used up." });
    expect(await searchStore(build, "lamp", undefined)).toEqual({ status: "ready", products: [good] });
  });

  test("a malformed answer shows no products instead of hanging", async () => {
    mockPostJson.mockResolvedValueOnce({ status: "ready", data: {} });

    expect(await searchStore(newBuild(), "art", "any")).toEqual({ status: "ready", products: [] });
  });
});

describe("loadLiveProducts", () => {
  const { getApi } = jest.requireMock("./api") as { getApi: jest.Mock };
  const { loadLiveProducts } = jest.requireActual("./store-search") as typeof import("./store-search");

  beforeEach(() => getApi.mockReset());

  test("asks only for real store ids, once each, and keeps good products", async () => {
    getApi.mockResolvedValueOnce({ status: "ready", data: [good, { id: "bad" }] });

    const products = await loadLiveProducts([good.id, good.id, "sample-sofa"]);

    expect(getApi).toHaveBeenCalledWith(`/api/shop/products?ids=${good.id}`);
    expect(products).toEqual([good]);
  });

  test("no store ids: no request", async () => {
    expect(await loadLiveProducts(["sample-sofa"])).toEqual([]);
    expect(getApi).not.toHaveBeenCalled();
  });

  test("a failed lookup gives no products, not an error", async () => {
    getApi.mockResolvedValueOnce({ status: "error", message: "offline" });

    expect(await loadLiveProducts([good.id])).toEqual([]);
  });
});
