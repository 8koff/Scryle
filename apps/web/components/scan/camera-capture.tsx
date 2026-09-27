"use client";

import type { Pack } from "@retrofit/core";
import { useCallback, useEffect, useRef, useState } from "react";
import { initialSnap, nextSnap, type SnapState } from "@/lib/capture/auto-snap";
import { loadDetector, type Detector } from "@/lib/capture/detector";
import { checkFrame, type FrameCheck, type FrameTarget } from "@/lib/capture/frame-check";
import { sharpness } from "@/lib/capture/sharpness";
import { FrameGuide } from "./frame-guide";

export type CapturedPhoto = { blob: Blob; url: string; width: number; height: number };

interface CameraCaptureProps {
  pack: Pack;
  onCapture: (photo: CapturedPhoto) => void;
  onCancel: () => void;
}

type CameraState = "starting" | "live" | "denied" | "unavailable";

const TICK_MS = 180;
const SAMPLE_WIDTH = 160;

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

/** Grabs the full-resolution frame, unmirrored, as a JPEG. */
async function grabFrame(video: HTMLVideoElement): Promise<CapturedPhoto | null> {
  const width = video.videoWidth;
  const height = video.videoHeight;
  if (!width || !height) return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? { blob, url: URL.createObjectURL(blob), width, height } : null;
}

export function CameraCapture({ pack, onCapture, onCancel }: CameraCaptureProps) {
  const video = useRef<HTMLVideoElement>(null);
  const sampler = useRef<HTMLCanvasElement | null>(null);
  const detector = useRef<Detector | null>(null);
  const snap = useRef<SnapState>(initialSnap);
  const isCapturing = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("starting");
  const [isDetectorReady, setIsDetectorReady] = useState(false);
  const [check, setCheck] = useState<FrameCheck>({ status: "missing", cue: "Starting camera…" });
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [hasVoice, setHasVoice] = useState(true);
  const [isFlashing, setIsFlashing] = useState(false);

  const mirrored = pack.capture.camera === "user";
  const target: FrameTarget = pack.capture.detect === "any" ? "any" : pack.capture.detect;
  const step = pack.capture.steps[0];

  const takePhoto = useCallback(async () => {
    if (isCapturing.current || !video.current) return;
    isCapturing.current = true;
    setIsFlashing(true);
    const photo = await grabFrame(video.current);
    if (photo) onCapture(photo);
    else isCapturing.current = false;
  }, [onCapture]);

  // Start the camera; stop every track when leaving.
  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) return setCameraState("unavailable");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: pack.capture.camera, width: { ideal: 1920 }, height: { ideal: 1920 } },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        setCameraState("live");
      } catch (error) {
        const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
        setCameraState(denied ? "denied" : "unavailable");
      }
    })();
    return () => {
      cancelled = true;
      stream?.getTracks().forEach((t) => t.stop());
      window.speechSynthesis?.cancel();
    };
  }, [pack.capture.camera]);

  // Load the detector in parallel. If it fails, framing falls back to sharpness only.
  useEffect(() => {
    if (target === "any") return;
    let active = true;
    loadDetector()
      .then((d) => {
        if (!active) return;
        detector.current = d;
        setIsDetectorReady(true);
      })
      .catch(() => {
        if (active) setIsDetectorReady(false);
      });
    return () => {
      active = false;
    };
  }, [target]);

  // The framing loop: detect, score sharpness, advance the auto-snap state.
  useEffect(() => {
    if (cameraState !== "live") return;
    let busy = false;
    const timer = window.setInterval(async () => {
      const el = video.current;
      if (busy || !el || isCapturing.current || !el.videoWidth) return;
      busy = true;
      try {
        sampler.current ??= document.createElement("canvas");
        const canvas = sampler.current;
        canvas.width = SAMPLE_WIDTH;
        canvas.height = Math.round((SAMPLE_WIDTH * el.videoHeight) / el.videoWidth);
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const score = sharpness(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const detections = detector.current ? await detector.current.detect(el) : [];
        const effectiveTarget = detector.current ? target : "any";
        const result = checkFrame({ detections, sharpness: score, target: effectiveTarget, mirrored });
        setCheck(result);

        const before = snap.current;
        snap.current = nextSnap(
          before,
          { now: performance.now(), isReady: result.status === "ready" },
          { holdMs: 600, countdownSec: pack.capture.countdownSec ?? 0, graceMs: 700 },
        );
        if (snap.current.secondsLeft !== before.secondsLeft) {
          setSecondsLeft(snap.current.secondsLeft);
          if (hasVoice && snap.current.phase === "counting") speak(String(snap.current.secondsLeft));
        }
        if (snap.current.phase === "snap") void takePhoto();
      } finally {
        busy = false;
      }
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [cameraState, target, mirrored, pack.capture.countdownSec, hasVoice, takePhoto]);

  // Space bar = shutter.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" && cameraState === "live") {
        e.preventDefault();
        void takePhoto();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cameraState, takePhoto]);

  const isAligned = check.status === "ready";
  const isCounting = secondsLeft > 0;

  return (
    <div className="on-dark fixed inset-0 z-50 flex flex-col bg-device text-device-fg">
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={video}
          playsInline
          muted
          className="absolute inset-0 size-full object-cover"
          style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
        />

        {cameraState === "live" && <FrameGuide pack={pack.id} isAligned={isAligned} />}

        {cameraState !== "live" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            {cameraState === "starting" && <p className="text-white/70">Starting camera…</p>}
            {cameraState === "denied" && (
              <>
                <p className="text-xl font-semibold">Camera access is off</p>
                <p className="max-w-xs text-white/65">
                  Allow camera access for this site in your browser settings, then come back and try again.
                </p>
              </>
            )}
            {cameraState === "unavailable" && (
              <>
                <p className="text-xl font-semibold">No camera found</p>
                <p className="max-w-xs text-white/65">Open this page on your phone to take the photo.</p>
              </>
            )}
          </div>
        )}

        {/* Top bar: close, what to do, voice toggle. */}
        <div className="absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close camera"
            className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-95"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
            </svg>
          </button>
          <p className="text-[15px] font-semibold">{step?.label}</p>
          <button
            type="button"
            onClick={() => setHasVoice((v) => !v)}
            aria-pressed={hasVoice}
            aria-label={hasVoice ? "Turn off spoken countdown" : "Turn on spoken countdown"}
            className="flex size-11 items-center justify-center rounded-full bg-black/40 backdrop-blur-md transition-transform active:scale-95"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 8h2.5L10 5v10l-3.5-3H4z" />
              {hasVoice ? <path d="M13 7.5a3.5 3.5 0 0 1 0 5M15 5.5a6.3 6.3 0 0 1 0 9" /> : <path d="m13.5 8 4 4m0-4-4 4" />}
            </svg>
          </button>
        </div>

        {isCounting && (
          <div aria-live="assertive" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span key={secondsLeft} className="text-[9rem] font-semibold leading-none text-white drop-shadow-[0_4px_24px_rgb(0_0_0/0.5)] motion-safe:animate-[tick_280ms_cubic-bezier(0.23,1,0.32,1)]">
              {secondsLeft}
            </span>
          </div>
        )}

        {isFlashing && <div aria-hidden className="pointer-events-none absolute inset-0 bg-white opacity-0 motion-safe:animate-[flash_450ms_ease-out_forwards]" />}
      </div>

      {/* Bottom: live cue and the manual shutter. */}
      <div className="flex flex-col items-center gap-5 bg-device px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-5">
        <p aria-live="polite" className={`min-h-6 text-center text-[16px] font-medium ${isAligned ? "text-accent-ink" : "text-white/85"}`}>
          {cameraState === "live" ? (isCounting ? "Hold that pose" : check.cue) : " "}
        </p>
        <div className="flex w-full items-center justify-between">
          <span className="w-16 text-[12px] leading-tight text-white/45">
            {target !== "any" && !isDetectorReady && cameraState === "live" ? "Auto-snap loading" : ""}
          </span>
          <button
            type="button"
            onClick={() => void takePhoto()}
            disabled={cameraState !== "live"}
            aria-label="Take photo"
            className="flex size-[76px] items-center justify-center rounded-full border-[3px] border-white/90 transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className={`size-[62px] rounded-full transition-colors ${isAligned ? "bg-accent" : "bg-white"}`} />
          </button>
          <span className="w-16" />
        </div>
      </div>
    </div>
  );
}
