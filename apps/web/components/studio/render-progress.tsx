"use client";

import { useEffect, useState } from "react";

/** A render takes about this long; the bar eases toward the end and waits there for the real finish. */
const EXPECTED_MS = 24_000;
const STEP_MS = 2200;

/**
 * While the render runs: a bar that fills over the usual time, and a line naming each swap in turn,
 * so the wait shows what is happening instead of a spinner.
 */
export function RenderProgress({ labels }: { labels: string[] }) {
  const [step, setStep] = useState(0);
  const [isStarted, setIsStarted] = useState(false);

  useEffect(() => {
    // Next frame, so the bar animates from empty.
    const frame = requestAnimationFrame(() => setIsStarted(true));
    const timer = window.setInterval(() => setStep((s) => s + 1), STEP_MS);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  const lines = [...labels.map((l) => `Placing ${l.toLowerCase()}`), "Matching the light", "Finishing the edges"];
  const line = lines[step % lines.length];

  return (
    <div role="status" aria-live="polite" className="mx-auto flex w-full max-w-sm flex-col items-center gap-2">
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full origin-left rounded-full bg-accent"
          style={{
            transform: `scaleX(${isStarted ? 0.94 : 0.02})`,
            transition: `transform ${EXPECTED_MS}ms cubic-bezier(0.2, 0.7, 0.3, 1)`,
          }}
        />
      </div>
      <p key={step} className="truncate text-[13px] text-muted motion-safe:animate-[fade-in_300ms_ease-out]">
        {line}…
      </p>
    </div>
  );
}
