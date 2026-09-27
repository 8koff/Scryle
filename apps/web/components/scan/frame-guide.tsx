import type { PackId } from "@retrofit/core";

interface FrameGuideProps {
  pack: PackId;
  /** Turns the guide solid denim when the shot is lined up. */
  isAligned: boolean;
}

/** The outline the subject should fill: a body for clothing, corner brackets for everything else. */
export function FrameGuide({ pack, isAligned }: FrameGuideProps) {
  const stroke = isAligned ? "var(--accent)" : "rgb(255 255 255 / 0.8)";

  if (pack === "clothing") {
    return (
      <svg
        aria-hidden
        viewBox="0 0 100 200"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[84%] -translate-x-1/2 -translate-y-1/2 transition-[filter] duration-300"
        style={{ filter: isAligned ? "drop-shadow(0 0 12px rgb(74 112 181 / 0.7))" : undefined }}
        fill="none"
        stroke={stroke}
        strokeWidth="1.1"
        strokeDasharray={isAligned ? undefined : "3 2.5"}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="50" cy="19" rx="9.5" ry="11.5" />
        <path d="M44 31.5c0 2.5-1 3.8-3.2 4.6L30 39.8c-4.4 1.6-6.6 4.7-7 9.4l-3.4 42c-.2 2.6 1.4 4.3 3.8 4.3 2 0 3.4-1.2 3.8-3.3l5-33.5L33 96l-1.2 84.5c0 3.4 1.9 5.3 5 5.3 3 0 4.8-1.8 5.1-5L46 121h8l4.1 59.8c.3 3.2 2.1 5 5.1 5 3.1 0 5-1.9 5-5.3L67 96l.8-37.3 5 33.5c.4 2.1 1.8 3.3 3.8 3.3 2.4 0 4-1.7 3.8-4.3l-3.4-42c-.4-4.7-2.6-7.8-7-9.4l-10.8-3.7c-2.2-.8-3.2-2.1-3.2-4.6" />
      </svg>
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-[6%] inset-y-[18%] transition-colors duration-300" style={{ color: stroke }}>
      {(["left-0 top-0 border-l-2 border-t-2 rounded-tl-xl", "right-0 top-0 border-r-2 border-t-2 rounded-tr-xl", "bottom-0 left-0 border-b-2 border-l-2 rounded-bl-xl", "bottom-0 right-0 border-b-2 border-r-2 rounded-br-xl"] as const).map((corner) => (
        <span key={corner} className={`absolute size-10 border-current ${corner}`} />
      ))}
    </div>
  );
}
