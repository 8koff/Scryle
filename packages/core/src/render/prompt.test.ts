import { describe, expect, it } from "vitest";
import { buildEditPrompt } from "./prompt";

describe("buildEditPrompt", () => {
  it("names the original photo as image 1 and each product by its image number", () => {
    const prompt = buildEditPrompt({
      subject: "a person standing in a hallway",
      swaps: [
        { part: "jacket", product: "black leather bomber jacket" },
        { part: "shoes", product: "white low-top sneakers" },
      ],
      locks: ["face", "body shape"],
    });

    expect(prompt).toContain("Image 1 is the original photo of a person standing in a hallway");
    expect(prompt).toContain("Replace the jacket with the black leather bomber jacket shown in image 2");
    expect(prompt).toContain("Replace the shoes with the white low-top sneakers shown in image 3");
  });

  it("lists every lock rule as something that must not change", () => {
    const prompt = buildEditPrompt({
      subject: "a white sedan",
      swaps: [{ part: "wheels", product: "gloss black 5-spoke wheels" }],
      locks: ["car body", "background"],
    });

    expect(prompt).toContain("Do not change: car body, background");
  });

  it("always asks for a photo-real edit at the same angle and lighting", () => {
    const prompt = buildEditPrompt({
      subject: "a living room",
      swaps: [{ part: "sofa", product: "green velvet sofa" }],
      locks: [],
    });

    expect(prompt).toMatch(/same camera angle/i);
    expect(prompt).toMatch(/same lighting/i);
    expect(prompt).toMatch(/photorealistic/i);
  });

  it("supports a swap described in words only, with no product image", () => {
    const prompt = buildEditPrompt({
      subject: "a living room",
      swaps: [{ part: "wall colour", product: "sage green paint (Benjamin Moore Saybrook Sage)", hasImage: false }],
      locks: [],
    });

    expect(prompt).toContain("Change the wall colour to sage green paint (Benjamin Moore Saybrook Sage)");
    expect(prompt).not.toContain("image 2");
  });

  it("numbers images correctly when a text-only swap sits between image swaps", () => {
    const prompt = buildEditPrompt({
      subject: "a living room",
      swaps: [
        { part: "wall colour", product: "sage green paint", hasImage: false },
        { part: "sofa", product: "green velvet sofa" },
      ],
      locks: [],
    });

    expect(prompt).toContain("green velvet sofa shown in image 2");
  });

  describe("with all products combined into one image", () => {
    const input = {
      subject: "a person standing in a hallway",
      swaps: [
        { part: "grey hoodie", product: "black leather bomber jacket" },
        { part: "wall colour", product: "sage green paint", hasImage: false },
        { part: "blue jeans", product: "olive cargo pants" },
      ],
      locks: ["face"],
      productsInOneImage: true,
    };

    it("says image 2 holds the products, numbered left to right", () => {
      const prompt = buildEditPrompt(input);
      expect(prompt).toContain("Image 2 shows 2 products side by side, numbered 1 to 2 from left to right");
    });

    it("points each swap at its product number in image 2", () => {
      const prompt = buildEditPrompt(input);
      expect(prompt).toContain("Replace the grey hoodie with product 1 in image 2 (black leather bomber jacket)");
      expect(prompt).toContain("Replace the blue jeans with product 2 in image 2 (olive cargo pants)");
      expect(prompt).toContain("Change the wall colour to sage green paint");
      expect(prompt).not.toContain("image 3");
    });

    it("falls back to the normal wording for a single product", () => {
      const prompt = buildEditPrompt({ ...input, swaps: [input.swaps[0]!] });
      expect(prompt).toContain("shown in image 2");
      expect(prompt).not.toContain("side by side");
    });
  });

  it("rejects an empty swap list", () => {
    expect(() => buildEditPrompt({ subject: "x", swaps: [], locks: [] })).toThrow(/at least one swap/i);
  });
});
