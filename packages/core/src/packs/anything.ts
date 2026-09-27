import type { Pack } from "./types";

export const anythingPack: Pack = {
  id: "anything",
  label: "Anything",
  tagline: "Point at anything. We find what you can swap.",
  capture: {
    camera: "environment",
    detect: "any",
    allowUpload: true,
    steps: [{ id: "center", label: "Centre it", cue: "Hold steady with the thing in the middle." }],
  },
  parts: [],
  products: "live-search",
  locks: ["everything not being swapped", "background", "camera angle"],
};
