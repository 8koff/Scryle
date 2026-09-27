"use client";

import { HudBox } from "@/components/ui/hud-box";
import type { ScanResult } from "@/lib/api";

export type ReviewState =
  | { kind: "confirm" }
  | { kind: "reading" }
  | { kind: "done"; result: ScanResult }
  | { kind: "error"; message: string };

interface ScanReviewProps {
  photoUrl: string;
  aspect: number;
  state: ReviewState;
  onRetake: () => void;
  onUse: () => void;
  onOpenStudio: () => void;
}

/** The captured photo, then the parts the photo reader found, drawn as brackets. */
export function ScanReview({ photoUrl, aspect, state, onRetake, onUse, onOpenStudio }: ScanReviewProps) {
  const isReading = state.kind === "reading";
  const parts = state.kind === "done" ? state.result.scene.parts : [];

  return (
    <div className="on-dark fixed inset-0 z-50 flex flex-col bg-device text-device-fg">
      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="relative max-h-full w-full max-w-[min(100%,calc((100svh-12rem)*var(--a)))]" style={{ aspectRatio: aspect, ["--a" as string]: aspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a local blob URL, not an optimisable asset */}
          <img src={photoUrl} alt="Your photo" className="size-full rounded-[18px] object-cover" />
          {isReading && (
            <div aria-hidden className="absolute inset-0 overflow-hidden rounded-[18px]">
              <div className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-accent/35 to-transparent motion-safe:animate-[scanline_1.6s_ease-in-out_infinite]" />
            </div>
          )}
          {parts.map((part, i) => (
            <HudBox key={`${part.partId}-${i}`} box={part.box} label={part.label} isActive={i === 0} labelPlacement="inside" />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        <p aria-live="polite" className="min-h-6 text-center text-[16px] font-medium text-white/85">
          {state.kind === "confirm" && "Happy with this one?"}
          {state.kind === "reading" && "Finding everything you can swap…"}
          {state.kind === "done" &&
            (parts.length ? `Found ${parts.length} thing${parts.length === 1 ? "" : "s"} you can swap` : "We couldn't spot anything to swap. Try another photo.")}
          {state.kind === "error" && <span className="text-white">{state.message}</span>}
        </p>
        <div className="flex w-full max-w-sm gap-3">
          <button
            type="button"
            onClick={onRetake}
            disabled={isReading}
            className="h-12 flex-1 rounded-full bg-white/10 text-[16px] font-semibold transition-[transform,opacity] active:scale-[0.97] disabled:opacity-40"
          >
            Retake
          </button>
          {state.kind !== "done" && (
            <button
              type="button"
              onClick={onUse}
              disabled={isReading}
              className="h-12 flex-1 rounded-full bg-accent text-[16px] font-semibold text-on-accent transition-[transform,opacity] active:scale-[0.97] disabled:opacity-60"
            >
              {state.kind === "error" ? "Try again" : isReading ? "Reading…" : "Use this photo"}
            </button>
          )}
          {state.kind === "done" && parts.length > 0 && (
            <button
              type="button"
              onClick={onOpenStudio}
              className="h-12 flex-1 rounded-full bg-accent text-[16px] font-semibold text-on-accent transition-transform active:scale-[0.97]"
            >
              Start swapping
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
