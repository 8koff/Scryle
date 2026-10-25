import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { jpegThumb, THUMB_MAX_PX } from "./thumbs";

const picture = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 120, g: 90, b: 60 } } }).jpeg().toBuffer();

describe("jpegThumb", () => {
  it("shrinks a kept picture to a small JPEG, keeping its shape", async () => {
    const thumb = await jpegThumb(await picture(1600, 1200));
    const meta = await sharp(thumb).metadata();

    expect(meta.format).toBe("jpeg");
    expect(meta.width).toBe(THUMB_MAX_PX);
    expect(meta.height).toBe(450);
  });

  it("never enlarges a small picture", async () => {
    const meta = await sharp(await jpegThumb(await picture(300, 400))).metadata();
    expect([meta.width, meta.height]).toEqual([300, 400]);
  });
});
