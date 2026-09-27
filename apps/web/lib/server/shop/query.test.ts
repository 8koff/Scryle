import type { SceneAnalysis } from "@retrofit/core";
import { describe, expect, it } from "vitest";
import { buildSearchQuery, searchKey } from "./query";

const scene = (details?: Record<string, string>, parts: SceneAnalysis["parts"] = []): SceneAnalysis => ({
  subject: "a thing",
  ...(details ? { details } : {}),
  parts,
});

describe("buildSearchQuery", () => {
  it("uses the usual term for a part", () => {
    expect(buildSearchQuery({ pack: "room", scene: scene(), partId: "rug" })).toEqual({ ok: true, query: "area rug" });
  });

  it("adds the shopper's words in front, once", () => {
    expect(buildSearchQuery({ pack: "room", scene: scene(), partId: "sofa", words: "green velvet" })).toEqual({ ok: true, query: "green velvet sofa" });
    expect(buildSearchQuery({ pack: "room", scene: scene(), partId: "sofa", words: "green velvet sofas" })).toEqual({ ok: true, query: "green velvet sofas" });
  });

  it("names the car for parts that must fit it", () => {
    const car = scene({ make: "Honda", model: "Civic", year: "2019" });
    expect(buildSearchQuery({ pack: "car", scene: car, partId: "wheels" })).toEqual({ ok: true, query: "2019 Honda Civic wheels" });
    expect(buildSearchQuery({ pack: "car", scene: car, partId: "exhaust" })).toEqual({ ok: true, query: "exhaust tips" });
  });

  it("uses the fit the photo reader saw, unless the shopper picks one", () => {
    const person = scene({ fit: "women" });
    expect(buildSearchQuery({ pack: "clothing", scene: person, partId: "outerwear" })).toEqual({ ok: true, query: "women's jacket" });
    expect(buildSearchQuery({ pack: "clothing", scene: person, partId: "outerwear", fit: "men" })).toEqual({ ok: true, query: "men's jacket" });
    expect(buildSearchQuery({ pack: "clothing", scene: person, partId: "outerwear", fit: "any" })).toEqual({ ok: true, query: "jacket" });
  });

  it("refuses swimwear and underwear words for clothing", () => {
    for (const words of ["red bikini", "lace bra", "swim trunks", "boxer briefs", "sheer"]) {
      expect(buildSearchQuery({ pack: "clothing", scene: scene(), partId: "top", words }).ok).toBe(false);
    }
  });

  it("uses the photo reader's name for parts of Anything", () => {
    const thing = scene(undefined, [{ partId: "shade", label: "Lamp shade", current: "white shade", box: { x: 0, y: 0, w: 0.5, h: 0.5 } }]);
    expect(buildSearchQuery({ pack: "anything", scene: thing, partId: "shade" })).toEqual({ ok: true, query: "Lamp shade" });
    expect(buildSearchQuery({ pack: "anything", scene: thing, partId: "missing" }).ok).toBe(false);
  });

  it("drops odd scene facts instead of searching them", () => {
    const car = scene({ make: "Honda<script>", model: "Civic" });
    expect(buildSearchQuery({ pack: "car", scene: car, partId: "wheels" })).toEqual({ ok: true, query: "Civic wheels" });
  });
});

describe("searchKey", () => {
  it("ignores case", () => {
    expect(searchKey("room", "sofa", "Green Sofa")).toBe(searchKey("room", "sofa", "green sofa"));
  });
});
