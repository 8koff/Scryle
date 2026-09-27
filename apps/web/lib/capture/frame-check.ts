/**
 * Decides, for one camera frame, whether the subject is framed well enough to take the shot,
 * and what to tell the user if not. Pure: fed by the on-device detector and a sharpness score.
 */

export type Detection = {
  /** coco-ssd class, e.g. "person", "car", "couch". */
  label: string;
  score: number;
  /** Frame-relative box, 0..1 from the top-left of the image as captured (not mirrored). */
  box: { x: number; y: number; w: number; h: number };
};

export type FrameTarget = "person" | "car" | "couch" | "any";

export type FrameStatus = "ready" | "missing" | "crowded" | "too-far" | "too-close" | "off-centre" | "blurry";

export type FrameCheck = { status: FrameStatus; cue: string };

type Rules = { minHeight: number; minWidth: number; edge: number; maxOffCentre: number };

const RULES: Record<Exclude<FrameTarget, "any">, Rules> = {
  // Full body: head and feet both inside, filling most of the height.
  person: { minHeight: 0.7, minWidth: 0, edge: 0.015, maxOffCentre: 0.14 },
  car: { minHeight: 0, minWidth: 0.6, edge: 0.01, maxOffCentre: 0.18 },
  couch: { minHeight: 0, minWidth: 0.35, edge: 0, maxOffCentre: 0.3 },
};

const MIN_SCORE = 0.55;
/** Variance-of-Laplacian threshold on a small greyscale frame; below this the photo is soft. */
export const MIN_SHARPNESS = 60;

const NAMES: Record<Exclude<FrameTarget, "any">, string> = { person: "yourself", car: "the car", couch: "the room" };

export function checkFrame({
  detections,
  sharpness,
  target,
  mirrored = false,
}: {
  detections: readonly Detection[];
  sharpness: number;
  target: FrameTarget;
  /** The preview is shown mirrored (front camera), so left/right cues are flipped for the user. */
  mirrored?: boolean;
}): FrameCheck {
  if (target !== "any") {
    const rules = RULES[target];
    const matches = detections.filter((d) => d.label === target && d.score >= MIN_SCORE);
    if (matches.length === 0) {
      return { status: "missing", cue: target === "person" ? "Step into the frame" : `Point the camera at ${NAMES[target]}` };
    }

    // For people, a second person is a problem. For cars and rooms, pick the biggest.
    const biggest = [...matches].sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h);
    const subject = biggest[0]!;
    if (target === "person" && biggest.length > 1 && biggest[1]!.box.h > 0.4) {
      return { status: "crowded", cue: "One person at a time" };
    }

    const { x, y, w, h } = subject.box;
    const touchesEdge = y <= rules.edge || y + h >= 1 - rules.edge || (target !== "person" && (x <= rules.edge || x + w >= 1 - rules.edge));
    if (touchesEdge && (h > 0.9 || w > 0.97)) {
      return { status: "too-close", cue: target === "person" ? "Step back so your head and feet fit" : "Move back a little" };
    }
    if (h < rules.minHeight || w < rules.minWidth) {
      return { status: "too-far", cue: target === "person" ? "Step a little closer" : "Move closer" };
    }

    const offset = x + w / 2 - 0.5;
    if (Math.abs(offset) > rules.maxOffCentre) {
      // Positive offset: subject sits right of centre in the captured image.
      const moveRight = offset < 0 !== mirrored;
      const who = target === "person" ? "Move" : "Aim";
      return { status: "off-centre", cue: `${who} a little to the ${moveRight ? "right" : "left"}` };
    }
  }

  if (sharpness < MIN_SHARPNESS) return { status: "blurry", cue: "Hold still" };
  return { status: "ready", cue: "Perfect — hold it" };
}
