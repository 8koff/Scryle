import type { StudioPart } from "@retrofit/core";
import { preselectChoices } from "./preselect";
import type { LiveProduct } from "./store-search";

const part = (id: string, label = id): StudioPart => ({ id, label, boxes: [] });

const sofa: LiveProduct = {
  id: "live-aaaaaaaaaaaaaaaaaaaa",
  pack: "room",
  part: "sofa",
  title: "Green velvet sofa",
  priceCents: 79999,
  store: "Example Store",
  image: "https://encrypted-tbn0.gstatic.com/images?q=1",
};

describe("preselectChoices", () => {
  test("puts built-in options and store products back on their parts", () => {
    const chosen = preselectChoices(
      "room",
      [part("sofa"), part("wall-colour")],
      [
        { partId: "sofa", productId: sofa.id },
        { partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" },
      ],
      [sofa],
    );

    expect(chosen.sofa).toEqual({ input: { partId: "sofa", productId: sofa.id }, label: sofa.title, product: sofa });
    expect(chosen["wall-colour"]).toEqual({
      input: { partId: "wall-colour", productId: "room-wall-colour-sage-green-matte-paint" },
      label: "Sage green matte paint",
    });
  });

  test("a jacket can land on a top (related parts)", () => {
    const chosen = preselectChoices("clothing", [part("top")], [{ partId: "outerwear", productId: "sample-bomber" }], []);

    expect(chosen.top?.input).toEqual({ partId: "top", productId: "sample-bomber" });
  });

  test("skips words-only swaps, unknown products, and parts not in this photo", () => {
    const chosen = preselectChoices(
      "car",
      [part("wheels")],
      [
        { partId: "paint", text: "matte black" },
        { partId: "wheels", productId: "live-bbbbbbbbbbbbbbbbbbbb" },
        { partId: "paint", productId: "car-paint-gloss-black-paint" },
      ],
      [],
    );

    expect(chosen).toEqual({});
  });

  test("one swap per part", () => {
    const chosen = preselectChoices(
      "car",
      [part("wheels")],
      [
        { partId: "wheels", productId: "sample-wheels" },
        { partId: "wheels", productId: "sample-wheels" },
      ],
      [],
    );

    expect(Object.keys(chosen)).toEqual(["wheels"]);
  });
});
