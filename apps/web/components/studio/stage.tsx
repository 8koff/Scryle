"use client";

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

/** The photo: tappable parts before a render, a before/after slider once one is done. */
export function Stage({ build, parts, activePartId, onPickPart, shown, isRendering, previews }: StageProps) {
  const aspect = build.width / build.height;

  if (shown?.status === "done" && shown.imageUrl) {
    return (
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
    );
  }

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
        parts.flatMap((part) =>
          part.boxes.map((box, i) => (
            <button
              key={`${part.id}-${i}`}
              type="button"
              onClick={() => onPickPart(part.id)}
              aria-label={`Swap ${part.label.toLowerCase()}`}
              aria-pressed={activePartId === part.id}
              className="absolute rounded-md outline-offset-2"
              style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%`, width: `${box.w * 100}%`, height: `${box.h * 100}%` }}
            >
              <HudBox box={{ x: 0, y: 0, w: 1, h: 1 }} label={i === 0 ? part.label : undefined} labelPlacement="inside" isActive={activePartId === part.id} />
            </button>
          )),
        )}

      {isRendering && (
        <div aria-hidden className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-x-0 h-28 bg-gradient-to-b from-transparent via-white/30 to-transparent motion-safe:animate-[scanline_1.8s_ease-in-out_infinite]" />
        </div>
      )}
    </div>
  );
}
