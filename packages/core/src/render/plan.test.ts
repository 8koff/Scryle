import { describe, expect, it } from "vitest";
import { carPack } from "../packs/car";
import { clothingPack } from "../packs/clothing";
import { roomPack } from "../packs/room";
import type { SceneAnalysis } from "../scene/schema";
import { buildRenderPlan } from "./plan";

const box = { x: 0.1, y: 0.1, w: 0.2, h: 0.2 };

const personScene: SceneAnalysis = {
  subject: "a person standing in a hallway",
  parts: [
    { partId: "top", label: "Grey hoodie", box, current: "grey hoodie" },
    { partId: "bottoms", label: "Jeans", box, current: "blue jeans" },
    { partId: "shoes", label: "Sneakers", box, current: "white sneakers" },
  ],
};

const jacket = { title: "Black leather bomber jacket", imageUrl: "https://cdn/jacket.jpg" };
const cargo = { title: "Olive cargo pants", imageUrl: "https://cdn/cargo.jpg" };

describe("buildRenderPlan", () => {
  it("turns a tapped part + chosen product into a swap of what is there now", () => {
    const plan = buildRenderPlan(clothingPack, personScene, [{ partId: "top", product: jacket }]);

    expect(plan.prompt).toContain("Replace the grey hoodie with the Black leather bomber jacket shown in image 2");
    expect(plan.productImageUrls).toEqual(["https://cdn/jacket.jpg"]);
  });

  it("locks the pack rules plus every part that is not being swapped", () => {
    const plan = buildRenderPlan(clothingPack, personScene, [{ partId: "top", product: jacket }]);

    expect(plan.prompt).toContain("face");
    expect(plan.prompt).toContain("body shape and proportions");
    expect(plan.prompt).toMatch(/Do not change:.*blue jeans.*white sneakers/);
    expect(plan.prompt).not.toMatch(/Do not change:.*grey hoodie/);
  });

  it("keeps product images in swap order for a multi-item render", () => {
    const plan = buildRenderPlan(clothingPack, personScene, [
      { partId: "bottoms", product: cargo },
      { partId: "top", product: jacket },
    ]);

    expect(plan.productImageUrls).toEqual(["https://cdn/cargo.jpg", "https://cdn/jacket.jpg"]);
    expect(plan.prompt).toContain("Olive cargo pants shown in image 2");
    expect(plan.prompt).toContain("Black leather bomber jacket shown in image 3");
  });

  it("sends no image for text-only parts like wall colour", () => {
    const roomScene: SceneAnalysis = {
      subject: "a living room",
      parts: [{ partId: "wall-colour", label: "Walls", box, current: "white walls" }],
    };
    const plan = buildRenderPlan(roomPack, roomScene, [
      { partId: "wall-colour", product: { title: "sage green matte paint", imageUrl: "https://cdn/swatch.jpg" } },
    ]);

    expect(plan.productImageUrls).toEqual([]);
    expect(plan.prompt).toContain("Change the white walls to sage green matte paint");
  });

  it("allows a product without an image by falling back to words", () => {
    const plan = buildRenderPlan(clothingPack, personScene, [{ partId: "top", product: { title: "red flannel shirt" } }]);

    expect(plan.productImageUrls).toEqual([]);
    expect(plan.prompt).toContain("Change the grey hoodie to red flannel shirt");
  });

  it("uses the pack part label when the part was picked from the list, not tapped", () => {
    const carScene: SceneAnalysis = { subject: "a white sedan", parts: [] };
    const plan = buildRenderPlan(carPack, carScene, [
      { partId: "wheels", product: { title: "gloss black wheels", imageUrl: "https://cdn/w.jpg" } },
    ]);

    expect(plan.prompt).toContain("Replace the wheels with the gloss black wheels");
  });

  it("can word the prompt for products combined into one image", () => {
    const plan = buildRenderPlan(
      clothingPack,
      personScene,
      [
        { partId: "top", product: jacket },
        { partId: "bottoms", product: cargo },
      ],
      { productsInOneImage: true },
    );

    expect(plan.productImageUrls).toEqual(["https://cdn/jacket.jpg", "https://cdn/cargo.jpg"]);
    expect(plan.prompt).toContain("product 2 in image 2 (Olive cargo pants)");
  });

  it("rejects two products for the same part", () => {
    expect(() =>
      buildRenderPlan(clothingPack, personScene, [
        { partId: "top", product: jacket },
        { partId: "top", product: cargo },
      ]),
    ).toThrow(/twice/);
  });

  it("rejects a part the pack does not know, unless the scene detected it", () => {
    expect(() => buildRenderPlan(clothingPack, personScene, [{ partId: "spoiler", product: jacket }])).toThrow(
      /unknown part/i,
    );
  });
});
