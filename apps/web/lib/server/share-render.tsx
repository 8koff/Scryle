import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { jpegForBox, shareLayout, SHARE_SIZE } from "./share";
import { ShareCard } from "./share-card";

let fonts: Promise<Buffer[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/instrument-sans-latin-500-normal.woff")),
    readFile(join(process.cwd(), "assets/fonts/instrument-sans-latin-600-normal.woff")),
  ]));

/** The 1080×1350 before/after card as PNG bytes. Free: no AI, just the two photos. */
export async function renderCardPng(before: Buffer, after: Buffer, aspect: number): Promise<Buffer> {
  const layout = shareLayout(aspect);
  const [beforeUrl, afterUrl, [medium, semibold]] = await Promise.all([
    jpegForBox(before, layout.before),
    jpegForBox(after, layout.after),
    loadFonts(),
  ]);
  const response = new ImageResponse(<ShareCard layout={layout} beforeUrl={beforeUrl} afterUrl={afterUrl} />, {
    ...SHARE_SIZE,
    fonts: [
      { name: "Instrument Sans", data: medium!, weight: 500, style: "normal" },
      { name: "Instrument Sans", data: semibold!, weight: 600, style: "normal" },
    ],
  });
  return Buffer.from(await response.arrayBuffer());
}
