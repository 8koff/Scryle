"use client";

import type { Build } from "@/lib/build/store";

interface VersionStripProps {
  build: Build;
  shownId: string | null;
  onShow: (versionId: string | null) => void;
}

const THUMB = "relative size-14 shrink-0 overflow-hidden rounded-xl border-2 transition-colors";

/** Original + every render, newest last. Going back is free: nothing re-renders. */
export function VersionStrip({ build, shownId, onShow }: VersionStripProps) {
  if (build.versions.length === 0) return null;
  return (
    <nav aria-label="Versions" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      <button
        type="button"
        onClick={() => onShow(null)}
        aria-pressed={shownId === null}
        aria-label="Original photo"
        className={`${THUMB} ${shownId === null ? "border-accent" : "border-transparent"}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail of a remote photo */}
        <img src={build.photoUrl} alt="" className="size-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-semibold text-white">Original</span>
      </button>
      {build.versions.map((v, i) => (
        <button
          key={v.id}
          type="button"
          onClick={() => onShow(v.id)}
          disabled={v.status !== "done"}
          aria-pressed={shownId === v.id}
          aria-label={`Version ${i + 1}: ${v.labels.join(", ")}${v.status === "rendering" ? " (in progress)" : v.status === "failed" ? " (failed)" : ""}`}
          className={`${THUMB} ${shownId === v.id ? "border-accent" : "border-transparent"} bg-surface-2`}
        >
          {v.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tiny thumbnail of a remote render
            <img src={v.imageUrl} alt="" className="size-full object-cover" />
          ) : (
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-muted">
              {v.status === "failed" ? "Failed" : <span className="size-4 animate-spin rounded-full border-2 border-muted border-t-transparent" />}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}
