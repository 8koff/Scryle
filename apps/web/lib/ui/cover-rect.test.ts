import { describe, expect, it } from "vitest";
import { coverRect } from "./cover-rect";

describe("coverRect", () => {
  it("crops top and bottom of a tall photo in a wide frame, around the focus point", () => {
    const rect = coverRect({ width: 1200, height: 600 }, 3 / 4, { x: 0.5, y: 0.3 });
    expect(rect.width).toBe(1200);
    expect(rect.height).toBe(1600);
    expect(rect.left).toBe(0);
    expect(rect.top).toBe(-300);
  });

  it("crops the sides of a wide photo in a tall frame", () => {
    const rect = coverRect({ width: 300, height: 400 }, 4 / 3, { x: 0.5, y: 0.5 });
    expect(rect.height).toBeCloseTo(400, 6);
    expect(rect.width).toBeCloseTo(533.33, 1);
    expect(rect.left).toBeCloseTo(-116.67, 1);
    expect(rect.top).toBeCloseTo(0, 6);
  });
});
