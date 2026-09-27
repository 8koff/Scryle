import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@retrofit/core";
import { SeamMark } from "@/lib/brand-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name}: see it before you buy it`;

const file = (path: string) => readFile(join(process.cwd(), path));
const jpeg = async (path: string) => `data:image/jpeg;base64,${(await file(path)).toString("base64")}`;

/** The picture chats and social sites show for the home page: the headline and a real room swap. */
export default async function OpenGraphImage() {
  const [before, after, medium, semibold] = await Promise.all([
    jpeg("public/demo/hero-room-before.jpg"),
    jpeg("public/demo/hero-room-after.jpg"),
    file("assets/fonts/instrument-sans-latin-500-normal.woff"),
    file("assets/fonts/instrument-sans-latin-600-normal.woff"),
  ]);
  const photo = { width: 560, height: 520 };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: BRAND.backgroundColor, padding: 55, fontFamily: "Instrument Sans", color: BRAND.inkColor }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 600 }}>
            <SeamMark size={44} ink={BRAND.inkColor} accent={BRAND.accentOnDarkColor} />
            {BRAND.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ fontSize: 78, fontWeight: 600, lineHeight: 0.98, letterSpacing: -2.5 }}>See it before you buy it.</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: BRAND.mutedColor, lineHeight: 1.3 }}>
              Take a photo. Tap a part. See the swap on your own photo.
            </div>
          </div>
        </div>
        <div style={{ display: "flex", width: photo.width, height: photo.height, borderRadius: 28, overflow: "hidden", position: "relative" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not the browser */}
          <img src={before} alt="" width={photo.width} height={photo.height} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
          <div style={{ position: "absolute", top: 0, right: 0, width: photo.width / 2, height: photo.height, display: "flex", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not the browser */}
            <img src={after} alt="" width={photo.width} height={photo.height} style={{ position: "absolute", top: 0, right: 0, objectFit: "cover" }} />
          </div>
          <div style={{ position: "absolute", top: 0, left: photo.width / 2 - 2, width: 4, height: photo.height, background: "#ffffff" }} />
          <div style={{ position: "absolute", bottom: 18, left: 18, background: "rgba(22,21,15,0.75)", color: "#fff", fontSize: 20, fontWeight: 600, padding: "6px 14px", borderRadius: 999 }}>Before</div>
          <div style={{ position: "absolute", bottom: 18, right: 18, background: "rgba(22,21,15,0.75)", color: "#fff", fontSize: 20, fontWeight: 600, padding: "6px 14px", borderRadius: 999 }}>AI example</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Instrument Sans", data: medium, weight: 500, style: "normal" },
        { name: "Instrument Sans", data: semibold, weight: 600, style: "normal" },
      ],
    },
  );
}
