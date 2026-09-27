import { describe, expect, it } from "vitest";
import { sharpness } from "./sharpness";

function image(width: number, height: number, pixel: (x: number, y: number) => number) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = pixel(x, y);
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { data, width, height };
}

describe("sharpness", () => {
  it("is zero for a flat grey frame", () => {
    expect(sharpness(image(32, 32, () => 128))).toBe(0);
  });

  it("scores a crisp checkerboard far higher than a smooth gradient", () => {
    const crisp = sharpness(image(32, 32, (x, y) => ((x + y) % 2 ? 255 : 0)));
    const soft = sharpness(image(32, 32, (x) => x * 8));
    expect(crisp).toBeGreaterThan(1000);
    expect(soft).toBeLessThan(10);
  });

  it("handles tiny frames without crashing", () => {
    expect(sharpness(image(2, 2, () => 0))).toBe(0);
  });
});
