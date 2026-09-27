import type { Pack } from "./types";

export const roomPack: Pack = {
  id: "room",
  label: "Room",
  tagline: "Redesign your space with real furniture.",
  capture: {
    camera: "environment",
    detect: "any",
    allowUpload: true,
    steps: [
      { id: "wide", label: "Wide shot", cue: "Stand in a corner. Pan slowly across the room." },
    ],
  },
  parts: [
    { id: "sofa", label: "Sofa" },
    { id: "chair", label: "Chair" },
    { id: "table", label: "Table" },
    { id: "rug", label: "Rug" },
    { id: "lamp", label: "Lamp" },
    { id: "light-fixture", label: "Light fixture" },
    { id: "wall-colour", label: "Wall colour", textOnly: true },
    { id: "curtains", label: "Curtains" },
    { id: "art", label: "Wall art" },
    { id: "bed", label: "Bed" },
    { id: "shelving", label: "Shelving" },
  ],
  products: "catalog",
  locks: ["room layout", "walls and windows position", "floor", "camera angle", "natural light"],
};
