/**
 * Turns a stream of "is the frame good?" answers into: keep aligning, count down, or take the shot.
 * Pure, so the camera component just feeds it frames.
 */

export type SnapConfig = {
  /** How long the frame must stay good before we commit. */
  holdMs: number;
  /** 0 = shoot right after the hold. Clothing uses 5 so you can step back. */
  countdownSec: number;
  /** A bad frame shorter than this (detector flicker) doesn't reset anything. */
  graceMs: number;
};

export type SnapState = {
  phase: "aligning" | "counting" | "snap";
  /** When the frame first became good (aligning) or when the countdown started (counting). */
  since: number | null;
  /** Last time the frame was good, for the grace period. */
  lastGood: number | null;
  secondsLeft: number;
};

export const initialSnap: SnapState = { phase: "aligning", since: null, lastGood: null, secondsLeft: 0 };

export function nextSnap(state: SnapState, frame: { now: number; isReady: boolean }, config: SnapConfig): SnapState {
  if (state.phase === "snap") return state;
  const { now, isReady } = frame;

  if (!isReady) {
    const lostFor = state.lastGood === null ? Infinity : now - state.lastGood;
    return lostFor > config.graceMs ? initialSnap : state;
  }

  if (state.phase === "aligning") {
    const since = state.since ?? now;
    if (now - since < config.holdMs) return { ...state, since, lastGood: now };
    if (config.countdownSec === 0) return { phase: "snap", since: now, lastGood: now, secondsLeft: 0 };
    return { phase: "counting", since: now, lastGood: now, secondsLeft: config.countdownSec };
  }

  // Counting.
  const elapsed = Math.floor((now - (state.since ?? now)) / 1000);
  const secondsLeft = config.countdownSec - elapsed;
  if (secondsLeft <= 0) return { phase: "snap", since: state.since, lastGood: now, secondsLeft: 0 };
  return { ...state, lastGood: now, secondsLeft };
}
