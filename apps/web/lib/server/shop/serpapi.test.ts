import { describe, expect, it, vi } from "vitest";
import { createSerpApi, errorText, parseHit, SerpApiError } from "./serpapi";

const hit = {
  position: 1,
  title: "Emerald Velvet Sofa",
  product_link: "https://www.google.com/search?ibp=oshop&q=sofa&prds=catalogid:1",
  immersive_product_page_token: "tok-1",
  source: "West Elm",
  price: "$1,299.00",
  extracted_price: 1299,
  thumbnail: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:abc",
  serpapi_thumbnail: "https://serpapi.com/images/url/xyz",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("parseHit", () => {
  it("keeps what we need, with the price in cents", () => {
    expect(parseHit(hit)).toEqual({
      title: "Emerald Velvet Sofa",
      priceCents: 129900,
      store: "West Elm",
      image: "https://encrypted-tbn2.gstatic.com/shopping?q=tbn:abc",
      googleLink: hit.product_link,
      offerToken: "tok-1",
    });
  });

  it("falls back to SerpApi's thumbnail copy", () => {
    expect(parseHit({ ...hit, thumbnail: undefined })?.image).toBe("https://serpapi.com/images/url/xyz");
  });

  it("drops results with no price, an odd image or a non-Google link", () => {
    expect(parseHit({ ...hit, extracted_price: undefined })).toBeNull();
    expect(parseHit({ ...hit, thumbnail: "https://evil.example/x.jpg", serpapi_thumbnail: undefined })).toBeNull();
    expect(parseHit({ ...hit, product_link: "https://evil.example/p" })).toBeNull();
    expect(parseHit({ ...hit, product_link: "https://google.com.evil.example/p" })).toBeNull();
    expect(parseHit(null)).toBeNull();
  });
});

describe("createSerpApi", () => {
  it("asks for US shopping results and skips bad ones", async () => {
    const fetch = vi.fn(async () => json({ shopping_results: [hit, { title: "broken" }] }));
    const api = createSerpApi({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });

    const hits = await api.search("green velvet sofa");

    expect(hits).toHaveLength(1);
    const url = new URL(String((fetch.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("engine")).toBe("google_shopping");
    expect(url.searchParams.get("q")).toBe("green velvet sofa");
    expect(url.searchParams.get("gl")).toBe("us");
  });

  it("reads store offers with their own links", async () => {
    const fetch = vi.fn(async () =>
      json({
        product_results: {
          stores: [
            { name: "West Elm", link: "https://www.westelm.com/p/1" },
            { name: "Plain http", link: "http://shop.example/p" },
            { name: "IP", link: "https://10.0.0.1/p" },
            { name: "Local", link: "https://localhost/p" },
            { name: "Google", link: "https://www.google.com/aclk?x=1" },
          ],
        },
      }),
    );
    const api = createSerpApi({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    expect(await api.offers("tok-1")).toEqual([{ name: "West Elm", link: "https://www.westelm.com/p/1" }]);
  });

  it("throws on an error answer (bad key, no searches left)", async () => {
    const fetch = vi.fn(async () => json({ error: "Your account has run out of searches." }));
    const api = createSerpApi({ apiKey: "k", fetch: fetch as unknown as typeof globalThis.fetch });
    await expect(api.search("sofa")).rejects.toBeInstanceOf(SerpApiError);
  });

  it("never logs the key", () => {
    expect(errorText(new Error("GET https://serpapi.com/search.json?q=x&api_key=secret123 failed"))).not.toContain("secret123");
  });

  it("needs a key", () => {
    expect(() => createSerpApi({ apiKey: " " })).toThrow(/SERPAPI_API_KEY/);
  });
});
