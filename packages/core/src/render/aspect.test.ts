import { describe, expect, it } from "vitest";
import { nearestAspectRatio } from "./aspect";

const ALLOWED = ["1:1", "3:4", "4:3", "9:16", "16:9", "2:3", "3:2"] as const;

describe("nearestAspectRatio", () => {
  it("returns an exact match", () => {
    expect(nearestAspectRatio(1200, 1600, ALLOWED)).toBe("3:4");
  });

  it("picks the closest ratio for a phone portrait photo", () => {
    // 1080x1920 is exactly 9:16
    expect(nearestAspectRatio(1080, 1920, ALLOWED)).toBe("9:16");
    // 1170x2532 (iPhone) is taller than 9:16, still closest to 9:16
    expect(nearestAspectRatio(1170, 2532, ALLOWED)).toBe("9:16");
  });

  it("picks the closest ratio for a landscape photo", () => {
    expect(nearestAspectRatio(4032, 3024, ALLOWED)).toBe("4:3");
  });

  it("ignores values that are not ratios, like 'auto'", () => {
    expect(nearestAspectRatio(1000, 1000, ["auto", "1:1"])).toBe("1:1");
  });

  it("throws on bad sizes", () => {
    expect(() => nearestAspectRatio(0, 100, ALLOWED)).toThrow();
    expect(() => nearestAspectRatio(100, -1, ALLOWED)).toThrow();
  });

  it("throws when no allowed value is a ratio", () => {
    expect(() => nearestAspectRatio(100, 100, ["auto"])).toThrow(/no usable aspect ratio/i);
  });
});
