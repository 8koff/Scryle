import type { Box } from "@retrofit/core";

interface HudBoxProps {
  /** Photo-relative box, 0..1 from the top-left. */
  box: Box;
  label?: string;
  /** The part currently chosen: accent corners and a filled label. */
  isActive?: boolean;
  /** "inside" keeps the label within the box, for parts near the top edge of a screen. */
  labelPlacement?: "above" | "inside";
  /** "lg" for big boxes (a whole car on the home page), so the corners still read. */
  size?: "sm" | "lg";
  className?: string;
}

/** Camera-style focus corners around a swappable part. Accent = "you can act on this". */
export function HudBox({ box, label, isActive = false, labelPlacement = "above", size = "sm", className = "" }: HudBoxProps) {
  const labelPosition =
    labelPlacement === "inside" ? "left-2 top-2" : "left-0 top-0 -translate-y-[calc(100%+6px)]";
  const isLarge = size === "lg";
  const corner = `absolute ${isLarge ? "size-9 drop-shadow-[0_0_6px_rgb(0_0_0/0.35)]" : "size-3.5"} ${
    isActive ? "border-accent" : "border-white/85"
  }`;
  const w = isLarge ? 3 : 2;
  return (
    <div
      className={`pointer-events-none absolute ${className}`}
      style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
    >
      <span className={`${corner} left-0 top-0 rounded-tl-[3px]`} style={{ borderLeftWidth: w, borderTopWidth: w }} />
      <span className={`${corner} right-0 top-0 rounded-tr-[3px]`} style={{ borderRightWidth: w, borderTopWidth: w }} />
      <span className={`${corner} bottom-0 left-0 rounded-bl-[3px]`} style={{ borderLeftWidth: w, borderBottomWidth: w }} />
      <span className={`${corner} bottom-0 right-0 rounded-br-[3px]`} style={{ borderRightWidth: w, borderBottomWidth: w }} />
      {label && (
        <span
          className={`absolute ${labelPosition} whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${
            isActive ? "bg-accent text-on-accent" : "bg-black/60 text-white backdrop-blur-md"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
