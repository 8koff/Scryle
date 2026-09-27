import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { combineProducts } from "./collage";

async function square(r: number, g: number, b: number, w = 400, h = 400): Promise<Uint8Array> {
  return sharp({ create: { width: w, height: h, channels: 3, background: { r, g, b } } }).png().toBuffer();
}

async function pixel(image: Uint8Array, x: number, y: number) {
  const { data, info } = await sharp(image).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return [data[i], data[i + 1], data[i + 2]];
}

describe("combineProducts", () => {
  it("places products left to right in the given order", async () => {
    const out = await combineProducts([await square(255, 0, 0), await square(0, 255, 0), await square(0, 0, 255)], {
      tileSize: 300,
      gap: 30,
    });
    const meta = await sharp(out).metadata();

    expect(meta.height).toBe(300);
    expect(meta.width).toBe(300 * 3 + 30 * 2);
    const [red, green, blue] = await Promise.all([pixel(out, 150, 150), pixel(out, 480, 150), pixel(out, 810, 150)]);
    expect(red![0]).toBeGreaterThan(200);
    expect(green![1]).toBeGreaterThan(200);
    expect(blue![2]).toBeGreaterThan(200);
  });

  it("fits a tall product inside its tile on a white background", async () => {
    const out = await combineProducts([await square(0, 0, 0, 100, 400), await square(0, 0, 0)], { tileSize: 200, gap: 20 });

    expect(await pixel(out, 5, 100)).toEqual([255, 255, 255]); // left padding of the tall item
    const centre = await pixel(out, 100, 100);
    expect(centre[0]).toBeLessThan(30);
  });

  it("returns a JPEG", async () => {
    const out = await combineProducts([await square(1, 2, 3), await square(4, 5, 6)]);
    expect((await sharp(out).metadata()).format).toBe("jpeg");
  });

  it("needs at least two products", async () => {
    await expect(combineProducts([await square(0, 0, 0)])).rejects.toThrow(/at least two/i);
  });

  it("shrinks tiles so a big outfit stays under the width limit", async () => {
    const six = await Promise.all(Array.from({ length: 6 }, () => square(9, 9, 9)));
    const out = await combineProducts(six, { tileSize: 1024, gap: 32, maxWidth: 3000 });
    expect((await sharp(out).metadata()).width).toBeLessThanOrEqual(3000);
  });
});
