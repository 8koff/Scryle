"use client";

import Image, { type StaticImageData } from "next/image";
import { coverRect, type Size } from "@/lib/ui/cover-rect";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";

interface CompareSliderProps {
  before: StaticImageData | string;
  after: StaticImageData | string;
  beforeAlt: string;
  afterAlt: string;
  /** Frame aspect ratio as width / height, e.g. 3 / 4. Leave out to size the frame with className. */
  aspect?: number;
  /**
   * The photos' own aspect ratio, when it differs from the frame (they are cropped to fill it).
   * The overlay is then laid over the visible photo, so part boxes stay on their parts.
   */
  photoAspect?: number;
  /** Which point of the photo stays in view when cropping, 0..1 (like object-position). */
  focus?: { x: number; y: number };
  /**
   * true: one short sweep after load, so people see it can be dragged.
   * "reveal": starts on the photo as it was, wipes the whole new version in, settles in the
   * middle, then sways gently until someone touches it. Reduced motion lands in the middle.
   */
  intro?: boolean | "reveal";
  priority?: boolean;
  sizes?: string;
  /** Rendered above both images (e.g. viewfinder brackets). */
  overlay?: ReactNode;
  /** For remote renders we don't run through the image optimiser. */
  unoptimized?: boolean;
  className?: string;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/** The reveal's timing, shared with overlays that animate along with it (see Hero). */
export const REVEAL = { wipeAt: 1500, wipeMs: 1300, settleAt: 3300 } as const;

/** The frame's size, kept up to date. Only measured when something needs it. */
function useFrameSize(ref: RefObject<HTMLDivElement | null>, isNeeded: boolean): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!isNeeded || !el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, isNeeded]);
  return size;
}

export function CompareSlider({
  before,
  after,
  beforeAlt,
  afterAlt,
  aspect,
  intro = false,
  priority = false,
  sizes = "(min-width: 768px) 50vw, 100vw",
  overlay,
  unoptimized = false,
  className = "",
  photoAspect,
  focus = { x: 0.5, y: 0.5 },
}: CompareSliderProps) {
  const [position, setPosition] = useState(intro === "reveal" ? 100 : intro ? 82 : 50);
  const [isDragging, setIsDragging] = useState(false);
  /** Length of the current automatic move; 0 once someone has touched the slider. */
  const [moveMs, setMoveMs] = useState(900);
  const [isTouched, setIsTouched] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const size = useFrameSize(frame, Boolean(photoAspect));
  const photoRect = photoAspect && size ? coverRect(size, photoAspect, focus) : null;
  const objectPosition = `${focus.x * 100}% ${focus.y * 100}%`;

  useEffect(() => {
    if (intro !== true) return;
    // With reduced motion the transition is off, so this simply lands in the middle.
    const timer = window.setTimeout(() => setPosition(50), 600);
    return () => window.clearTimeout(timer);
  }, [intro]);

  useEffect(() => {
    if (intro !== "reveal" || isTouched) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const now = window.setTimeout(() => setPosition(50), 0);
      return () => window.clearTimeout(now);
    }
    const steps: Array<[at: number, to: number, ms: number]> = [
      [REVEAL.wipeAt, 0, REVEAL.wipeMs],
      [REVEAL.settleAt, 50, 800],
    ];
    const timers = steps.map(([at, to, ms]) =>
      window.setTimeout(() => {
        setMoveMs(ms);
        setPosition(to);
      }, at),
    );
    // Then a slow sway, so the page never looks frozen.
    let flip = false;
    let swayTimer = 0;
    const sway = window.setTimeout(() => {
      const tick = () => {
        flip = !flip;
        setMoveMs(3000);
        setPosition(flip ? 40 : 60);
      };
      tick();
      swayTimer = window.setInterval(tick, 3200);
    }, REVEAL.settleAt + 1400);
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      window.clearTimeout(sway);
      window.clearInterval(swayTimer);
    };
  }, [intro, isTouched]);

  /** Any drag or key stops the automatic moves for good. */
  const touch = () => {
    if (isTouched) return;
    setIsTouched(true);
    setMoveMs(0);
  };

  const moveTo = useCallback((clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    setPosition(clamp(((clientX - rect.left) / rect.width) * 100));
  }, []);

  // Respond on press, track 1:1 while dragging, keep tracking outside the frame.
  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) return; // ignore a second finger
    e.currentTarget.setPointerCapture(e.pointerId);
    touch();
    setIsDragging(true);
    moveTo(e.clientX);
  };
  const handlePointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (isDragging) moveTo(e.clientX);
  };
  const handlePointerUp = () => setIsDragging(false);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 4;
    if (e.key === "ArrowLeft") setPosition((p) => clamp(p - step));
    else if (e.key === "ArrowRight") setPosition((p) => clamp(p + step));
    else if (e.key === "Home") setPosition(0);
    else if (e.key === "End") setPosition(100);
    else return;
    touch();
    e.preventDefault();
  };

  // Only the automatic moves animate; dragging and keys follow instantly.
  const settle = isDragging || moveMs === 0 ? "" : "transition-[clip-path,left] ease-in-out motion-reduce:transition-none";
  const settleStyle = settle ? { transitionDuration: `${moveMs}ms` } : undefined;
  const isWiping = intro === "reveal" && !isTouched && position === 0;

  return (
    <div
      ref={frame}
      className={`photo-edge relative cursor-ew-resize touch-pan-y select-none overflow-hidden bg-surface-2 ${className}`}
      style={aspect ? { aspectRatio: aspect } : undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <Image src={before} alt={beforeAlt} fill priority={priority} sizes={sizes} unoptimized={unoptimized} className="object-cover" style={{ objectPosition }} draggable={false} />
      <div className={`absolute inset-0 ${settle}`} style={{ clipPath: `inset(0 0 0 ${position}%)`, ...settleStyle }}>
        <Image src={after} alt={afterAlt} fill priority={priority} sizes={sizes} unoptimized={unoptimized} className="object-cover" style={{ objectPosition }} draggable={false} />
      </div>

      {photoAspect ? (
        photoRect && (
          <div className="pointer-events-none absolute" style={photoRect}>
            {overlay}
          </div>
        )
      ) : (
        overlay
      )}

      <span className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
        Before
      </span>
      {/* Every "after" in the app is made by AI, and the label says so. */}
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-black">
        After (AI edit)
      </span>

      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare before and after"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(position)}
        aria-valuetext={`${Math.round(100 - position)}% after`}
        onKeyDown={handleKeyDown}
        className={`absolute inset-y-0 w-0 outline-none ${settle}`}
        style={{ left: `${position}%`, ...settleStyle }}
      >
        <div
          className={`absolute inset-y-0 -left-px w-[2px] bg-white transition-shadow duration-500 ${
            isWiping || (intro === "reveal" && !isTouched && position > 50)
              ? "shadow-[0_0_24px_6px_rgb(255_255_255/0.75)]"
              : "shadow-[0_0_0_1px_rgb(0_0_0/0.1)]"
          }`}
        />
        <div className="absolute left-1/2 top-1/2 flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow-[0_0_0_3px_rgb(255_255_255/0.9),0_4px_14px_rgb(0_0_0/0.35)]">
          <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="currentColor">
            <path d="M7.5 5.5 3 10l4.5 4.5v-9ZM12.5 5.5v9L17 10l-4.5-4.5Z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
