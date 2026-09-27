import { describe, expect, it } from "vitest";
import { partForQuery, styleWordsFrom } from "./terms";

const room = [
  { id: "sofa", label: "Sofa" },
  { id: "table", label: "Table" },
  { id: "rug", label: "Rug" },
  { id: "lamp", label: "Lamp" },
];

describe("partForQuery", () => {
  it("finds the part a search is about, by its name or another name", () => {
    expect(partForQuery("room", room, "walnut coffee table")).toBe("table");
    expect(partForQuery("room", room, "green velvet couch")).toBe("sofa");
    expect(partForQuery("room", room, "jute carpets")).toBe("rug");
  });

  it("lets the last word decide", () => {
    expect(partForQuery("room", room, "rug for under a sofa")).toBe("sofa");
    expect(partForQuery("room", room, "sofa table")).toBe("table");
  });

  it("returns null when nothing in the photo matches", () => {
    expect(partForQuery("room", room, "ceiling fan")).toBeNull();
    expect(partForQuery("room", room, "")).toBeNull();
  });

  it("knows clothing and car words", () => {
    const outfit = [
      { id: "outerwear", label: "Jacket or coat" },
      { id: "shoes", label: "Shoes" },
    ];
    expect(partForQuery("clothing", outfit, "white leather sneakers")).toBe("shoes");
    expect(partForQuery("clothing", outfit, "black bomber")).toBe("outerwear");
    expect(partForQuery("car", [{ id: "wheels", label: "Wheels" }], "bronze rims")).toBe("wheels");
  });

  it("uses the photo reader's names for parts of Anything", () => {
    expect(partForQuery("anything", [{ id: "shade", label: "Lamp shade" }], "linen lamp shade")).toBe("shade");
  });
});

describe("styleWordsFrom", () => {
  it("keeps colours, finishes and style names, at most two", () => {
    expect(styleWordsFrom("Walnut Mid-Century Coffee Table")).toBe("walnut mid-century");
    expect(styleWordsFrom("Ashley Darcy Black Sofa")).toBe("black");
    expect(styleWordsFrom("black black matte gold")).toBe("black matte");
  });

  it("is empty when there is no style word", () => {
    expect(styleWordsFrom("Ashley Altari Sofa")).toBe("");
  });
});
