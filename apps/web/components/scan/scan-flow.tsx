"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { Pack } from "@retrofit/core";
import type { ApiResponse, ScanResult } from "@/lib/api";
import { browserBuildStore } from "@/lib/build/store";
import { takeRemix } from "@/lib/build/remix";
import { CameraCapture, type CapturedPhoto } from "./camera-capture";
import { ScanIntro } from "./scan-intro";
import { ScanReview, type ReviewState } from "./scan-review";

type Step = { kind: "intro" } | { kind: "camera" } | { kind: "review"; photo: CapturedPhoto; state: ReviewState };

const MAX_EDGE = 2048;

/** Loads a picked file, shrinks it to at most 2048px on the long edge, and re-encodes as JPEG. */
async function prepareFile(file: File): Promise<CapturedPhoto> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  if (!blob) throw new Error("Could not read that image");
  return { blob, url: URL.createObjectURL(blob), width, height };
}

export function ScanFlow({ pack }: { pack: Pack }) {
  const [step, setStep] = useState<Step>({ kind: "intro" });
  const [isAdultConfirmed, setIsAdultConfirmed] = useState(false);
  const router = useRouter();

  // Free the previous photo's memory when it is replaced.
  const photoUrl = step.kind === "review" ? step.photo.url : null;
  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const review = useCallback((photo: CapturedPhoto) => setStep({ kind: "review", photo, state: { kind: "confirm" } }), []);

  const handleUpload = async (file: File) => {
    try {
      review(await prepareFile(file));
    } catch {
      window.alert("That file couldn't be opened. Please pick a JPEG, PNG or WebP photo.");
    }
  };

  const handleUse = async () => {
    if (step.kind !== "review") return;
    const { photo } = step;
    setStep({ kind: "review", photo, state: { kind: "reading" } });

    const form = new FormData();
    form.append("pack", pack.id);
    form.append("photo", photo.blob, "photo.jpg");
    if (isAdultConfirmed) form.append("adult", "yes");

    let next: ReviewState;
    try {
      const response = await fetch("/api/scan", { method: "POST", body: form });
      const body = (await response.json()) as ApiResponse<ScanResult>;
      next = body.success ? { kind: "done", result: body.data } : { kind: "error", message: body.error };
    } catch {
      next = { kind: "error", message: "No connection. Check your internet and try again." };
    }
    setStep((current) => (current.kind === "review" && current.photo === photo ? { ...current, state: next } : current));
  };

  return (
    <>
      <ScanIntro
        pack={pack}
        isAdultConfirmed={isAdultConfirmed}
        onAdultChange={setIsAdultConfirmed}
        onOpenCamera={() => setStep({ kind: "camera" })}
        onUpload={handleUpload}
      />
      {step.kind === "camera" && (
        <CameraCapture pack={pack} onCapture={review} onCancel={() => setStep({ kind: "intro" })} />
      )}
      {step.kind === "review" && (
        <ScanReview
          photoUrl={step.photo.url}
          aspect={step.photo.width / step.photo.height}
          state={step.state}
          onRetake={() => setStep(pack.capture.allowUpload ? { kind: "intro" } : { kind: "camera" })}
          onUse={handleUse}
          onOpenStudio={() => {
            if (step.state.kind !== "done") return;
            const { photoUrl, width, height, scene, token } = step.state.result;
            const preselect = takeRemix(window.sessionStorage, pack.id);
            const build = browserBuildStore().create({ pack: pack.id, photoUrl, width, height, scene, token, preselect });
            router.push(`/app/build/${build.id}`);
          }}
        />
      )}
    </>
  );
}
