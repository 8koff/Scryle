import { describe, expect, it } from "vitest";
import { remixChoices, saveRemix, takeRemix } from "./remix";

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

const box = { x: 0, y: 0, w: 0.1, h: 0.1 };

describe("remix storage", () => {
  it("hands the swaps to the next scan in the same category, once", () => {
    const storage = memoryStorage();
    saveRemix(storage, { pack: "clothing", from: "abcdefgh23", selections: [{ partId: "outerwear", productId: "sample-bomber" }] });
    expect(takeRemix(storage, "room")).toBeUndefined();
    expect(takeRemix(storage, "clothing")).toEqual([{ partId: "outerwear", productId: "sample-bomber" }]);
    expect(takeRemix(storage, "clothing")).toBeUndefined();
  });

  it("ignores broken data", () => {
    const storage = memoryStorage();
    storage.setItem("retrofit:remix", "{not json");
    expect(takeRemix(storage, "clothing")).toBeUndefined();
  });
});

describe("remixChoices", () => {
  it("puts a shared jacket on the matching part of the new photo", () => {
    const chosen = remixChoices("clothing", [{ id: "outerwear", label: "Jacket", boxes: [box] }], [{ partId: "outerwear", productId: "sample-bomber" }]);
    expect(chosen.outerwear).toMatchObject({ label: "Black leather bomber jacket", input: { partId: "outerwear", productId: "sample-bomber" } });
  });

  it("uses a related part when the exact one wasn't found (jacket over a top)", () => {
    const chosen = remixChoices("clothing", [{ id: "top", label: "Top", boxes: [box] }], [{ partId: "outerwear", productId: "sample-bomber" }]);
    expect(Object.keys(chosen)).toEqual(["top"]);
  });

  it("skips swaps that don't fit this photo or aren't known", () => {
    const chosen = remixChoices(
      "clothing",
      [{ id: "shoes", label: "Shoes", boxes: [box] }],
      [
        { partId: "outerwear", productId: "sample-bomber" },
        { partId: "shoes", productId: "nope" },
      ],
    );
    expect(chosen).toEqual({});
  });
});
