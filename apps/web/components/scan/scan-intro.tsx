"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import type { Pack } from "@retrofit/core";
import { HudBox } from "@/components/ui/hud-box";
import { INTROS } from "@/lib/scan/intro";

interface ScanIntroProps {
  pack: Pack;
  isAdultConfirmed: boolean;
  onAdultChange: (value: boolean) => void;
  onOpenCamera: () => void;
  onUpload: (file: File) => void;
}

function PrivacyLink() {
  return (
    <Link href="/privacy#share" target="_blank" className="whitespace-nowrap font-medium underline underline-offset-2 hover:text-fg">
      How we use it
    </Link>
  );
}

export function ScanIntro({ pack, isAdultConfirmed, onAdultChange, onOpenCamera, onUpload }: ScanIntroProps) {
  const intro = INTROS[pack.id];
  const checkboxId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [hasTriedWithoutConfirm, setHasTriedWithoutConfirm] = useState(false);
  const needsAdult = pack.capture.requireAdult === true;
  const isBlocked = needsAdult && !isAdultConfirmed;

  const handleOpenCamera = () => {
    if (isBlocked) return setHasTriedWithoutConfirm(true);
    onOpenCamera();
  };

  const [isDragging, setIsDragging] = useState(false);
  const handleDrop = (e: DragEvent<HTMLElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && pack.capture.allowUpload) onUpload(file);
  };
  const dropProps = pack.capture.allowUpload
    ? {
        onDragOver: (e: DragEvent<HTMLElement>) => {
          e.preventDefault();
          setIsDragging(true);
        },
        onDragLeave: () => setIsDragging(false),
        onDrop: handleDrop,
      }
    : {};

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onUpload(file);
    e.target.value = "";
  };

  return (
    <section
      aria-labelledby="scan-title"
      {...dropProps}
      className={`grid gap-6 rounded-[24px] border p-3 transition-colors sm:p-4 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] md:items-center md:gap-10 ${
        isDragging ? "border-accent bg-accent/10" : "border-line bg-surface"
      }`}
    >
      <div className="relative mx-auto aspect-[4/5] h-[26svh] overflow-hidden rounded-[16px] bg-surface-2 md:h-auto md:max-h-[60svh] md:w-full">
        <Image
          src={intro.image}
          alt=""
          fill
          priority
          sizes="(min-width: 768px) 45vw, 90vw"
          className="object-cover"
          style={{ objectPosition: intro.imagePosition }}
        />
        <HudBox box={{ x: 0.07, y: 0.06, w: 0.86, h: 0.88 }} isActive />
      </div>

      <div className="px-1 pb-2 md:py-4 md:pr-6">
        <h2 id="scan-title" className="text-[1.6rem] font-semibold leading-tight tracking-tight sm:text-[1.9rem]">
          {intro.title}
        </h2>

        <ol className="mt-5 space-y-3.5">
          {intro.tips.map((tip, i) => (
            <li key={tip} className="flex gap-4">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-line text-[12px] font-semibold tabular-nums text-muted">
                {i + 1}
              </span>
              <p className="text-[15px] leading-[1.5]">{tip}</p>
            </li>
          ))}
        </ol>

        {needsAdult && (
          <label htmlFor={checkboxId} className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl bg-surface-2 p-4">
            <input
              id={checkboxId}
              type="checkbox"
              checked={isAdultConfirmed}
              onChange={(e) => onAdultChange(e.target.checked)}
              className="mt-0.5 size-5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[15px] leading-snug">
              I&apos;m 18 or older, this is a photo of me, and I agree that it is sent to our AI partners (Anthropic and
              Higgsfield) to make the try-on. <PrivacyLink />
              {hasTriedWithoutConfirm && !isAdultConfirmed && (
                <span role="alert" className="mt-1 block text-[14px] text-accent-ink">
                  Please confirm to continue.
                </span>
              )}
            </span>
          </label>
        )}

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenCamera}
            aria-disabled={isBlocked}
            className={`inline-flex h-12 items-center rounded-full bg-accent px-7 text-[16px] font-semibold text-on-accent transition-[transform,opacity] duration-150 ease-out active:scale-[0.97] ${isBlocked ? "opacity-50" : ""}`}
          >
            Open camera
          </button>
          {pack.capture.allowUpload && (
            <>
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="inline-flex h-12 items-center rounded-full border border-line px-5 text-[16px] font-semibold transition-colors hover:border-fg"
              >
                Upload a photo
              </button>
              <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFile} />
            </>
          )}
        </div>

        {pack.capture.allowsPeople ? (
          <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-muted">
            For your safety, try-on only works with a live photo taken here.
          </p>
        ) : (
          <p className="mt-5 max-w-md text-[13px] leading-relaxed text-muted">
            {pack.capture.allowUpload && <span className="hidden md:inline">Or drop a photo anywhere on this card. </span>}
            No people in the photo, please. Your photo is sent to our AI partners (Anthropic and Higgsfield) to find the
            parts and make your swap. <PrivacyLink />
          </p>
        )}
      </div>
    </section>
  );
}
