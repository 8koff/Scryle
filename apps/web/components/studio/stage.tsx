"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import type { Box } from "@retrofit/core";
import { CompareSlider } from "@/components/ui/compare-slider";
import { HudBox } from "@/components/ui/hud-box";
import type { Build, Version } from "@/lib/build/store";
import type { StudioPart } from "@/lib/build/parts";

export type Preview = { partId: string; image?: string; swatch?: string };

interface StageProps {
  build: Build;
  parts: StudioPart[];
  activePartId: string | null;
  onPickPart: (partId: string) => void;
  /** The version on screen; null shows the original photo with tap targets. */
  shown: Version | null;
  isRendering: boolean;
  previews: Preview[];
}

function PreviewOverlay({ box, preview }: { box: Box; preview: Preview }) {
  const style = { left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` };
  if (preview.swatch) {
    return <span aria-hidden className="absolute rounded-md mix-blend-color" style={{ ...style, backgroundColor: preview.swatch, opacity: 0.55 }} />;
  }
  if (!preview.image) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a quick, rough placement preview
    <img aria-hidden src={preview.image} alt="" className="absolute object-contain opacity-80 drop-shadow-xl" style={style} />
  );
}

/** A pick, pinned to the corner of its part like a sticker. Tap it to see that part's options. */
function PickSticker({ box, preview, label, onClick }: { box: Box; preview: Preview; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: change your pick`}
      className="absolute z-10 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center overflow-hidden rounded-full bg-white shadow-[0_6px_18px_rgb(0_0_0/0.45)] ring-2 ring-accent transition-transform duration-150 ease-out hover:scale-110 active:scale-95 motion-safe:animate-[sticker-in_320ms_var(--ease-out)]"
      style={{ left: `${Math.min(0.97, box.x + box.w) * 100}%`, top: `${Math.max(0.03, box.y) * 100}%` }}
    >
      {preview.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- a small product thumbnail
        <img src={preview.image} alt="" className="size-full object-contain p-1" />
      ) : preview.swatch ? (
        <span className="size-full" style={{ backgroundColor: preview.swatch }} />
      ) : (
        // A described swap (words, no product picture): a plain "picked" mark.
        <span className="grid size-full place-items-center bg-accent text-on-accent">
          <Check aria-hidden className="size-5" strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

/** A finished render: drag to compare, or hold the button to flip back to the photo as it was. */
function DoneStage({ build, shown }: { build: Build; shown: Version & { imageUrl: string } }) {
  const [isPeeking, setIsPeeking] = useState(false);
  const aspect = build.width / build.height;
  const peek = (on: boolean) => () => setIsPeeking(on);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <CompareSlider
          key={shown.id}
          before={build.photoUrl}
          after={shown.imageUrl}
          beforeAlt="Your original photo"
          afterAlt={`Your photo with ${shown.labels.join(", ")}`}
          aspect={aspect}
          intro
          unoptimized
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="rounded-[20px]"
        />
        {isPeeking && (
          // eslint-disable-next-line @next/next/no-img-element -- the original photo, shown while held
          <img
            src={build.photoUrl}
            alt="Your original photo"
            className="pointer-events-none absolute inset-0 size-full rounded-[20px] object-cover motion-safe:animate-[fade-in_120ms_ease-out]"
          />
        )}
      </div>
      <button
        type="button"
        onPointerDown={peek(true)}
        onPointerUp={peek(false)}
        onPointerLeave={peek(false)}
        onPointerCancel={peek(false)}
        onKeyDown={(e) => (e.key === " " || e.key === "Enter") && setIsPeeking(true)}
        onKeyUp={peek(false)}
        onContextMenu={(e) => e.preventDefault()}
        aria-pressed={isPeeking}
        className="mx-auto h-9 touch-none select-none rounded-full border border-line px-4 text-[13px] font-semibold text-muted transition-colors hover:border-fg hover:text-fg aria-pressed:border-accent aria-pressed:text-fg"
      >
        {isPeeking ? "This is how it was" : "Hold to see before"}
      </button>
    </div>
  );
}

/** The photo: tappable parts before a render, a before/after slider once one is done. */
export function Stage({ build, parts, activePartId, onPickPart, shown, isRendering, previews }: StageProps) {
  const aspect = build.width / build.height;

  if (shown?.status === "done" && shown.imageUrl) return <DoneStage build={build} shown={{ ...shown, imageUrl: shown.imageUrl }} />;
  const picked = new Map(previews.map((p) => [p.partId, p]));

  return (
    <div className="photo-edge relative overflow-hidden rounded-[20px] bg-surface-2" style={{ aspectRatio: aspect }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote, short-lived photo */}
      <img src={build.photoUrl} alt="Your photo" className="absolute inset-0 size-full object-cover" />

      {isRendering &&
        previews.flatMap((preview) =>
          (parts.find((p) => p.id === preview.partId)?.boxes ?? []).map((box, i) => (
            <PreviewOverlay key={`${preview.partId}-${i}`} box={box} preview={preview} />
          )),
        )}

      {!isRendering &&
        parts.flatMap((part, n) =>
          part.boxes.map((box, i) => (
            <button
              key={`${part.id}-${i}`}
              type="button"
              onClick={() => onPickPart(part.id)}
              aria-label={`Swap ${part.label.toLowerCase()}`}
              aria-pressed={activePartId === part.id}
              className="group absolute rounded-md outline-offset-2 motion-safe:animate-[box-in_420ms_var(--ease-out)_both]"
              style={{
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
                animationDelay: `${150 + n * 90}ms`,
              }}
            >
              <span className="absolute inset-0 rounded-md bg-white/0 transition-colors duration-200 group-hover:bg-white/10" />
              <HudBox
                box={{ x: 0, y: 0, w: 1, h: 1 }}
                label={i === 0 ? part.label : undefined}
                labelPlacement="inside"
                isActive={activePartId === part.id || picked.has(part.id)}
              />
            </button>
          )),
        )}

      {!isRendering &&
        parts.flatMap((part) => {
          const preview = picked.get(part.id);
          const box = part.boxes[0];
          return preview && box ? [<PickSticker key={`sticker-${part.id}-${preview.image ?? preview.swatch}`} box={box} preview={preview} label={part.label} onClick={() => onPickPart(part.id)} />] : [];
        })}

      {isRendering && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-white/30 to-transparent motion-safe:animate-[scanline_1.8s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  );
}
