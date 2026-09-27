import type { Pack } from "./types";

export const carPack: Pack = {
  id: "car",
  label: "Car",
  tagline: "New wheels, new paint, new stance.",
  capture: {
    camera: "environment",
    detect: "car",
    allowUpload: true,
    steps: [
      { id: "front-34", label: "Front three-quarter", cue: "Stand at the front corner. Fit the whole car in the outline." },
      { id: "side", label: "Side", cue: "Walk to the side. Keep both wheels in view." },
      { id: "rear-34", label: "Rear three-quarter", cue: "Walk to the back corner." },
      { id: "wheel", label: "Wheel close-up", cue: "Crouch and fill the circle with one wheel." },
    ],
  },
  parts: [
    { id: "wheels", label: "Wheels" },
    { id: "tires", label: "Tires" },
    { id: "paint", label: "Paint or wrap", textOnly: true },
    { id: "tint", label: "Window tint", textOnly: true },
    { id: "headlights", label: "Headlights" },
    { id: "suspension", label: "Ride height", textOnly: true },
    { id: "spoiler", label: "Spoiler" },
    { id: "exhaust", label: "Exhaust tips" },
    { id: "calipers", label: "Brake calipers" },
  ],
  products: "catalog",
  locks: ["car body shape", "make and model", "license plate", "background", "camera angle"],
};
