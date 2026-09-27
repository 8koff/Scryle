import { describe, expect, it } from "vitest";
import { toSceneAnalysis, type VisionOutput } from "./normalize";

const base: VisionOutput = {
  subject: "a white 2019 Honda Civic sedan",
  has_person: false,
  details: [
    { key: "make", value: "Honda" },
    { key: "model", value: "Civic" },
  ],
  parts: [{ part_id: "wheels", label: "Front wheel", current: "silver 5-spoke wheels", x0: 520, y0: 500, x1: 680, y1: 800 }],
};

describe("toSceneAnalysis", () => {
  it("passes on whether a person is in the photo", () => {
    expect(toSceneAnalysis(base, ["wheels"]).hasPerson).toBe(false);
    expect(toSceneAnalysis({ ...base, has_person: true }, ["wheels"]).hasPerson).toBe(true);
  });

  it("converts 0-1000 corner coordinates to 0-1 boxes", () => {
    const scene = toSceneAnalysis(base, ["wheels"]);
    expect(scene.parts[0]?.box).toEqual({ x: 0.52, y: 0.5, w: 0.16, h: 0.3 });
  });

  it("turns the details list into a record", () => {
    expect(toSceneAnalysis(base, ["wheels"]).details).toEqual({ make: "Honda", model: "Civic" });
  });

  it("clamps boxes that spill past the photo edge", () => {
    const spill = { ...base, parts: [{ ...base.parts[0]!, x0: -20, x1: 1040 }] };
    const box = toSceneAnalysis(spill, ["wheels"]).parts[0]!.box;
    expect(box.x).toBe(0);
    expect(box.x + box.w).toBeCloseTo(1);
  });

  it("fixes swapped corners", () => {
    const swapped = { ...base, parts: [{ ...base.parts[0]!, x0: 680, x1: 520 }] };
    expect(toSceneAnalysis(swapped, ["wheels"]).parts[0]?.box.x).toBe(0.52);
  });

  it("drops zero-size boxes", () => {
    const flat = { ...base, parts: [{ ...base.parts[0]!, y1: 500 }] };
    expect(toSceneAnalysis(flat, ["wheels"]).parts).toEqual([]);
  });

  it("drops parts the pack does not know", () => {
    const odd = { ...base, parts: [{ ...base.parts[0]!, part_id: "rocket" }] };
    expect(toSceneAnalysis(odd, ["wheels"]).parts).toEqual([]);
  });

  it("keeps any part id when the pack has no fixed list (anything pack)", () => {
    const odd = { ...base, parts: [{ ...base.parts[0]!, part_id: "bike-saddle" }] };
    expect(toSceneAnalysis(odd, []).parts[0]?.partId).toBe("bike-saddle");
  });

  it("omits details when there are none", () => {
    expect(toSceneAnalysis({ ...base, details: [] }, ["wheels"]).details).toBeUndefined();
  });
});
