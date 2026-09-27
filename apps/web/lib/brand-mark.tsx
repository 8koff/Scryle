import { BRAND } from "@retrofit/core";

/**
 * The Seam mark (chosen 2026-09-26): the before/after slider as a logo. An outlined square,
 * its right half in denim, split by a seam with the slider's round handle on it. Plain SVG
 * attributes, so the same drawing works in the page and in next/og images.
 */
export function SeamMark({
  size,
  ink = "currentColor",
  accent = "var(--accent)",
  className,
}: {
  size: number;
  /** Outline, seam and handle. */
  ink?: string;
  /** The "after" half. */
  accent?: string;
  className?: string;
}) {
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" className={className} aria-hidden>
      <path d="M16 3H24A5 5 0 0 1 29 8V24A5 5 0 0 1 24 29H16Z" fill={accent} />
      <rect x="3" y="3" width="26" height="26" rx="5" stroke={ink} strokeWidth="2.4" />
      <path d="M16 2v28" stroke={ink} strokeWidth="2.4" />
      <circle cx="16" cy="16" r="4.6" fill={ink} />
    </svg>
  );
}

/**
 * The mark on the dark page colour, for generated icons (tab icon, home screen icon). `size`
 * is the square's side in pixels. Plain inline styles: this is drawn by next/og, not the browser.
 */
export function BrandMark({ size }: { size: number }) {
  return (
    <div style={{ width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.backgroundColor }}>
      <SeamMark size={size * 0.7} ink={BRAND.inkColor} accent={BRAND.accentOnDarkColor} />
    </div>
  );
}
