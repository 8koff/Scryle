import { productIdsOf, swapItems } from "./swap-items";
import type { LiveProduct } from "./store-search";

const frame: LiveProduct = {
  id: "live-aaaaaaaaaaaaaaaaaaaa",
  pack: "room",
  part: "bed",
  title: "IKEA RÅDMANSÖ bed frame",
  priceCents: 34900,
  store: "IKEA",
  image: "https://encrypted-tbn0.gstatic.com/images?q=1",
};

describe("swapItems", () => {
  test("store products get links; colours and described swaps stay as labels, in order", () => {
    const items = swapItems(
      [
        { partId: "wall-colour", text: "Deep navy matte paint" },
        { partId: "bed", productId: frame.id },
        { partId: "rug", productId: "room-rug-sample" },
      ],
      ["Deep navy matte paint", frame.title, "Jute rug"],
      [frame],
    );

    expect(items.products).toEqual([frame]);
    expect(items.others).toEqual(["Deep navy matte paint", "Jute rug"]);
  });

  test("a product that didn't load keeps its label, so nothing silently disappears", () => {
    const items = swapItems([{ partId: "bed", productId: frame.id }], [frame.title], []);

    expect(items.products).toEqual([]);
    expect(items.others).toEqual([frame.title]);
  });

  test("tolerates a label list that doesn't match the selections", () => {
    expect(swapItems([], ["Old label"], []).others).toEqual(["Old label"]);
    expect(swapItems([{ partId: "bed", productId: frame.id }], [], [frame]).products).toEqual([frame]);
  });
});

describe("productIdsOf", () => {
  test("only selections that name a product", () => {
    expect(productIdsOf([{ partId: "bed", productId: frame.id }, { partId: "wall", text: "Sage" }])).toEqual([frame.id]);
  });
});
