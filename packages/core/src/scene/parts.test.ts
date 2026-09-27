import { describe, expect, it } from "vitest";
import { partAtPoint } from "./parts";
import { SceneAnalysisSchema, type DetectedPart } from "./schema";

const body: DetectedPart = { partId: "paint", label: "Body paint", box: { x: 0.05, y: 0.15, w: 0.9, h: 0.65 }, current: "white paint" };
const wheel: DetectedPart = { partId: "wheels", label: "Front wheel", box: { x: 0.52, y: 0.5, w: 0.16, h: 0.3 }, current: "silver 5-spoke" };

describe("partAtPoint", () => {
  it("returns the part under the tap", () => {
    expect(partAtPoint([body], 0.3, 0.3)?.partId).toBe("paint");
  });

  it("prefers the smallest box when boxes overlap, so a wheel wins over the whole car", () => {
    expect(partAtPoint([body, wheel], 0.6, 0.65)?.partId).toBe("wheels");
    expect(partAtPoint([wheel, body], 0.6, 0.65)?.partId).toBe("wheels");
  });

  it("returns undefined when the tap misses everything", () => {
    expect(partAtPoint([wheel], 0.1, 0.1)).toBeUndefined();
  });

  it("counts a tap exactly on the edge as a hit", () => {
    expect(partAtPoint([wheel], 0.52, 0.5)?.partId).toBe("wheels");
  });
});

describe("SceneAnalysisSchema", () => {
  it("accepts a valid analysis", () => {
    const parsed = SceneAnalysisSchema.parse({
      subject: "a white 2019 Honda Civic sedan",
      details: { make: "Honda", model: "Civic", year: "2019" },
      parts: [wheel],
    });
    expect(parsed.parts).toHaveLength(1);
  });

  it("rejects boxes outside the photo", () => {
    const bad = { ...wheel, box: { x: 0.9, y: 0.5, w: 0.3, h: 0.3 } };
    expect(() => SceneAnalysisSchema.parse({ subject: "car", parts: [bad] })).toThrow();
  });

  it("rejects negative or zero-size boxes", () => {
    const bad = { ...wheel, box: { x: 0.1, y: 0.1, w: 0, h: 0.2 } };
    expect(() => SceneAnalysisSchema.parse({ subject: "car", parts: [bad] })).toThrow();
  });
});
