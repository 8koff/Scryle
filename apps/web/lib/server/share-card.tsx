import { BRAND } from "@retrofit/core";
import { SeamMark } from "@/lib/brand-mark";
import type { Box, ShareLayout } from "./share";

const INK = BRAND.inkColor;
const MUTED = BRAND.mutedColor;
const WELL = "#252320";
/** The after photo is always an AI edit, and the card says so on the picture itself. */
const AFTER_LABEL = "After (AI edit)";

function Photo({ src, label, box, isFront }: { src: string; label: "Before" | typeof AFTER_LABEL; box: Box; isFront: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        position: "absolute",
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        borderRadius: 28,
        overflow: "hidden",
        background: WELL,
        // The front photo gets a paper edge and a soft shadow so the overlap reads clearly.
        ...(isFront ? { border: `10px solid ${BRAND.backgroundColor}`, boxShadow: "0 24px 60px rgba(0,0,0,0.45)" } : {}),
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- rendered to a PNG, not a page */}
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      <div
        style={{
          display: "flex",
          position: "absolute",
          left: 20,
          bottom: 20,
          padding: "8px 18px",
          borderRadius: 999,
          background: label === AFTER_LABEL ? BRAND.accentOnDarkColor : "rgba(18,17,16,0.78)",
          color: "#fff",
          fontSize: 26,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
    </div>
  );
}

/** The before/after card. Satori supports a subset of CSS: flexbox and absolute positioning. */
export function ShareCard({ layout, beforeUrl, afterUrl }: { layout: ShareLayout; beforeUrl: string; afterUrl: string }) {
  const isStagger = layout.mode === "stagger";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: layout.pad,
        background: BRAND.backgroundColor,
        color: INK,
        fontFamily: "Instrument Sans",
      }}
    >
      <div style={{ display: "flex", position: "relative", width: layout.area.width, height: layout.area.height }}>
        <Photo src={beforeUrl} label="Before" box={layout.before} isFront={false} />
        <Photo src={afterUrl} label={AFTER_LABEL} box={layout.after} isFront={isStagger} />
      </div>
      <div style={{ display: "flex", height: layout.footer, alignItems: "flex-end", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 52, fontWeight: 600, letterSpacing: -1.5 }}>
            <SeamMark size={48} ink={INK} accent={BRAND.accentOnDarkColor} />
            {BRAND.name}
          </div>
          <div style={{ display: "flex", marginTop: 6, fontSize: 26, fontWeight: 500, color: MUTED }}>Scan anything. Swap any part.</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, fontWeight: 600, color: BRAND.accentInkColor }}>{BRAND.shareHashtag}</div>
      </div>
    </div>
  );
}
