import type { Pack } from "./types";

export const clothingPack: Pack = {
  id: "clothing",
  label: "Clothing",
  tagline: "Try on anything, then buy it.",
  capture: {
    camera: "user",
    detect: "person",
    countdownSec: 5,
    allowUpload: false,
    requireAdult: true,
    allowsPeople: true,
    steps: [
      {
        id: "full-body",
        label: "Full body",
        cue: "Lean your phone on something. Step back until your whole body fits the outline.",
      },
    ],
  },
  parts: [
    { id: "top", label: "Top" },
    { id: "outerwear", label: "Jacket or coat" },
    { id: "bottoms", label: "Pants or skirt" },
    { id: "shoes", label: "Shoes" },
    { id: "hat", label: "Hat" },
    { id: "bag", label: "Bag" },
    { id: "glasses", label: "Glasses" },
    { id: "jewellery", label: "Jewellery" },
  ],
  products: "catalog",
  locks: ["face", "facial expression", "hair", "body shape and proportions", "skin tone", "pose", "hands", "background"],
};
