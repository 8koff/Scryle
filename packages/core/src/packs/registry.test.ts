import { describe, expect, it } from "vitest";
import { getPack, isPackId, PACKS } from "./registry";

describe("pack registry", () => {
  it("has the four packs in home-screen order, clothing first", () => {
    expect(PACKS.map((p) => p.id)).toEqual(["clothing", "car", "room", "anything"]);
  });

  it("finds packs by id and rejects unknown ones", () => {
    expect(getPack("car").label).toBe("Car");
    expect(() => getPack("boats")).toThrow(/unknown pack/i);
    expect(isPackId("room")).toBe(true);
    expect(isPackId("boats")).toBe(false);
  });

  it("gives every pack unique part ids and at least one capture step", () => {
    for (const pack of PACKS) {
      const ids = pack.parts.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(pack.capture.steps.length).toBeGreaterThan(0);
    }
  });

  it("keeps clothing live-camera only, 18+, and face/body locked", () => {
    const clothing = getPack("clothing");
    expect(clothing.capture.allowUpload).toBe(false);
    expect(clothing.capture.requireAdult).toBe(true);
    expect(clothing.locks).toEqual(expect.arrayContaining(["face", "body shape and proportions"]));
  });

  it("lets the anything pack find its own parts and search live", () => {
    const anything = getPack("anything");
    expect(anything.parts).toEqual([]);
    expect(anything.products).toBe("live-search");
  });
});
