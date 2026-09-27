import { getPack } from "@retrofit/core";
import { describe, expect, it } from "vitest";
import { remixChoices } from "@/lib/build/remix";
import type { StudioPart } from "@/lib/build/parts";
import { findProduct, fitsPart } from "./catalog";
import { cleanDescription } from "./describe";
import { LOOKS, looksFor } from "./looks";

describe("looks", () => {
  it("only use products that exist and fit their part", () => {
    for (const look of LOOKS) {
      for (const s of look.selections) {
        if (!("productId" in s)) continue;
        const product = findProduct(s.productId);
        expect(product, `${look.id}: ${s.productId}`).toBeDefined();
        expect(fitsPart(product!, look.pack, s.partId), `${look.id}: ${s.productId}`).toBe(true);
      }
    }
  });

  it("only use words that pass the same check as a typed swap", () => {
    for (const look of LOOKS) {
      for (const s of look.selections) {
        if ("text" in s) expect(cleanDescription(s.text, look.pack), `${look.id}: ${s.text}`).toEqual({ ok: true, text: s.text });
      }
    }
  });

  it("only name parts their category has, one swap per part", () => {
    for (const look of LOOKS) {
      const partIds = look.selections.map((s) => s.partId);
      expect(new Set(partIds).size, look.id).toBe(partIds.length);
      const known = new Set(getPack(look.pack).parts.map((p) => p.id));
      for (const id of partIds) expect(known.has(id), `${look.id}: ${id}`).toBe(true);
    }
  });

  it("never use typed words for clothing", () => {
    for (const look of looksFor("clothing")) expect(look.selections.every((s) => "productId" in s)).toBe(true);
  });

  it("apply only to the parts found in this photo", () => {
    const japandi = LOOKS.find((l) => l.id === "room-japandi")!;
    const parts: StudioPart[] = [
      { id: "sofa", label: "Sofa", boxes: [] },
      { id: "wall-colour", label: "Wall colour", boxes: [] },
    ];
    const chosen = remixChoices("room", parts, japandi.selections);
    expect(Object.keys(chosen).sort()).toEqual(["sofa", "wall-colour"]);
    expect(chosen.sofa?.label).toBe("low light oak sofa with oatmeal linen cushions");
  });
});
