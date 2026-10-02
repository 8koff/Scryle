import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { BRAND } from "@retrofit/core";
import { SeamMark } from "@/lib/brand-mark";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = `${BRAND.name}: point at anything, tap it, swap it. Join the waitlist.`;

/** The waitlist page's colours (`.theme-paper` in globals.css). */
const PAPER = "#f3f0ea";
const INK = "#161513";
const MUTED = "#625e57";
const DENIM = "#3d63a8";

const file = (path: string) => readFile(join(process.cwd(), path));
const jpeg = async (path: string) => `data:image/jpeg;base64,${(await file(path)).toString("base64")}`;

const label = { position: "absolute", bottom: 16, fontSize: 18, fontWeight: 600, padding: "5px 12px", borderRadius: 999 } as const;

/**
 * The card X and chats show for the waitlist link. Light, so it stands out in a dark feed:
 * the headline on the left, the room swap in a tilted dark frame on the right.
 */
export default async function OpenGraphImage() {
  const [before, after, medium, semibold] = await Promise.all([
    jpeg("public/demo/hero-room-before.jpg"),
    jpeg("public/demo/hero-room-after.jpg"),
    file("assets/fonts/instrument-sans-latin-500-normal.woff"),
    file("assets/fonts/instrument-sans-latin-600-normal.woff"),
  ]);
  const photo = { width: 520, height: 480 };

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: PAPER, padding: 55, fontFamily: "Instrument Sans", color: INK }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingRight: 40 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 38, fontWeight: 600 }}>
            <SeamMark size={44} ink={INK} accent={DENIM} />
            {BRAND.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1, letterSpacing: -2.5 }}>
              <span>Point at anything.</span>
              <span>Tap it.</span>
              <span style={{ color: DENIM }}>Swap it.</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 500, color: MUTED }}>Join the waitlist at scryle.app</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 560 }}>
          <div style={{ display: "flex", padding: 10, borderRadius: 32, background: INK, transform: "rotate(2deg)" }}>
            <div style={{ display: "flex", width: photo.width, height: photo.height, borderRadius: 22, overflow: "hidden", position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not the browser */}
              <img src={before} alt="" width={photo.width} height={photo.height} style={{ position: "absolute", inset: 0, objectFit: "cover" }} />
              <div style={{ position: "absolute", top: 0, right: 0, width: photo.width / 2, height: photo.height, display: "flex", overflow: "hidden" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- drawn by next/og, not the browser */}
                <img src={after} alt="" width={photo.width} height={photo.height} style={{ position: "absolute", top: 0, right: 0, objectFit: "cover" }} />
              </div>
              <div style={{ position: "absolute", top: 0, left: photo.width / 2 - 2, width: 4, height: photo.height, background: "#ffffff" }} />
              <div
                style={{ position: "absolute", top: 250, right: 18, display: "flex", alignItems: "center", gap: 10, background: "#ffffff", color: INK, fontSize: 21, fontWeight: 600, padding: "8px 16px 8px 12px", borderRadius: 999 }}
              >
                <div style={{ width: 16, height: 16, borderRadius: 999, background: DENIM, border: "3px solid #ffffff", boxShadow: `0 0 0 2px ${DENIM}` }} />
                Sofa → Cream bouclé
              </div>
              <div style={{ ...label, left: 16, background: "rgba(0,0,0,0.6)", color: "#ffffff" }}>Before</div>
              <div style={{ ...label, right: 16, background: "#ffffff", color: "#000000" }}>After (AI edit)</div>
            </div>
          </div>
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
