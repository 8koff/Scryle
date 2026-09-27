import { describe, expect, it } from "vitest";
import { initialSnap, nextSnap, type SnapConfig } from "./auto-snap";

const withCountdown: SnapConfig = { holdMs: 600, countdownSec: 5, graceMs: 700 };
const instant: SnapConfig = { holdMs: 600, countdownSec: 0, graceMs: 700 };

function run(config: SnapConfig, frames: Array<[number, boolean]>) {
  return frames.reduce((state, [now, isReady]) => nextSnap(state, { now, isReady }, config), initialSnap);
}

describe("auto snap", () => {
  it("waits while the subject is not framed", () => {
    expect(run(withCountdown, [[0, false], [500, false]]).phase).toBe("aligning");
  });

  it("starts the countdown only after the frame has been good for the hold time", () => {
    expect(run(withCountdown, [[0, true], [300, true]]).phase).toBe("aligning");
    const state = run(withCountdown, [[0, true], [650, true]]);
    expect(state.phase).toBe("counting");
    expect(state.secondsLeft).toBe(5);
  });

  it("counts down in whole seconds, then snaps", () => {
    const frames: Array<[number, boolean]> = [[0, true], [650, true], [1700, true], [3700, true]];
    expect(run(withCountdown, frames).secondsLeft).toBe(2);
    expect(run(withCountdown, [...frames, [5700, true]]).phase).toBe("snap");
  });

  it("ignores a brief flicker during the countdown", () => {
    const state = run(withCountdown, [[0, true], [650, true], [1000, false], [1300, true]]);
    expect(state.phase).toBe("counting");
  });

  it("resets when the subject stays out of frame longer than the grace period", () => {
    const state = run(withCountdown, [[0, true], [650, true], [1000, false], [1800, false]]);
    expect(state.phase).toBe("aligning");
  });

  it("snaps straight after the hold when there is no countdown", () => {
    expect(run(instant, [[0, true], [650, true]]).phase).toBe("snap");
  });

  it("stays snapped once snapped", () => {
    const state = run(instant, [[0, true], [650, true], [900, false]]);
    expect(state.phase).toBe("snap");
  });
});
