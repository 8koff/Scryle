import { describe, expect, it } from "vitest";
import { checkFrame, type Detection } from "./frame-check";

const person = (x: number, y: number, w: number, h: number, score = 0.9): Detection => ({
  label: "person",
  score,
  box: { x, y, w, h },
});

const SHARP = 200;

describe("checkFrame (full body)", () => {
  it("is ready when one person fills the outline, centred, and the frame is sharp", () => {
    const result = checkFrame({ detections: [person(0.3, 0.06, 0.4, 0.88)], sharpness: SHARP, target: "person" });
    expect(result.status).toBe("ready");
  });

  it("asks you to step into frame when nobody is there", () => {
    expect(checkFrame({ detections: [], sharpness: SHARP, target: "person" }).status).toBe("missing");
  });

  it("ignores weak detections", () => {
    const result = checkFrame({ detections: [person(0.3, 0.06, 0.4, 0.88, 0.3)], sharpness: SHARP, target: "person" });
    expect(result.status).toBe("missing");
  });

  it("asks you to step back when your head or feet are cut off", () => {
    expect(checkFrame({ detections: [person(0.3, 0, 0.4, 0.99)], sharpness: SHARP, target: "person" }).status).toBe(
      "too-close",
    );
  });

  it("asks you to come closer when you are small in the frame", () => {
    expect(checkFrame({ detections: [person(0.4, 0.3, 0.2, 0.45)], sharpness: SHARP, target: "person" }).status).toBe(
      "too-far",
    );
  });

  it("asks you to move to the centre", () => {
    const result = checkFrame({ detections: [person(0.02, 0.06, 0.35, 0.88)], sharpness: SHARP, target: "person" });
    expect(result.status).toBe("off-centre");
    expect(result.cue).toMatch(/right/i);
  });

  it("says which way to move from the camera's point of view when mirrored", () => {
    const result = checkFrame({
      detections: [person(0.02, 0.06, 0.35, 0.88)],
      sharpness: SHARP,
      target: "person",
      mirrored: true,
    });
    expect(result.cue).toMatch(/left/i);
  });

  it("asks you to hold still when the frame is blurry", () => {
    expect(checkFrame({ detections: [person(0.3, 0.06, 0.4, 0.88)], sharpness: 10, target: "person" }).status).toBe(
      "blurry",
    );
  });

  it("asks for one person at a time", () => {
    const result = checkFrame({
      detections: [person(0.1, 0.06, 0.35, 0.88), person(0.55, 0.06, 0.35, 0.88)],
      sharpness: SHARP,
      target: "person",
    });
    expect(result.status).toBe("crowded");
  });
});

describe("checkFrame (car)", () => {
  const car = (x: number, y: number, w: number, h: number): Detection => ({ label: "car", score: 0.9, box: { x, y, w, h } });

  it("is ready when the car fills most of the width", () => {
    expect(checkFrame({ detections: [car(0.06, 0.25, 0.88, 0.5)], sharpness: SHARP, target: "car" }).status).toBe("ready");
  });

  it("does not complain about other cars in the background", () => {
    const result = checkFrame({
      detections: [car(0.06, 0.25, 0.88, 0.5), car(0.8, 0.3, 0.15, 0.1)],
      sharpness: SHARP,
      target: "car",
    });
    expect(result.status).toBe("ready");
  });
});

describe("checkFrame (no target)", () => {
  it("only needs a sharp frame", () => {
    expect(checkFrame({ detections: [], sharpness: SHARP, target: "any" }).status).toBe("ready");
    expect(checkFrame({ detections: [], sharpness: 5, target: "any" }).status).toBe("blurry");
  });
});
