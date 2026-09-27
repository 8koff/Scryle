export type PackId = "clothing" | "car" | "room" | "anything";

export type PartDef = {
  id: string;
  label: string;
  /** Swapped by description only (paint colour, wall colour, tint level): no product image is sent. */
  textOnly?: boolean;
};

export type CaptureStep = {
  id: string;
  /** Shown on screen during capture: "Front three-quarter". */
  label: string;
  /** Short spoken/on-screen cue: "Step back until your whole body fits the outline". */
  cue: string;
};

export type Pack = {
  id: PackId;
  label: string;
  /** One line on the home tile. */
  tagline: string;
  capture: {
    camera: "user" | "environment";
    /** coco-ssd class the subject must match before auto-snap, or "any" to skip the check. */
    detect: "person" | "car" | "couch" | "any";
    steps: CaptureStep[];
    countdownSec?: number;
    /** Clothing is live-camera only, so nobody can dress up a stranger's photo. */
    allowUpload: boolean;
    /** The user must confirm they are 18+ before capture. */
    requireAdult?: boolean;
    /**
     * Photos may show a person. Other packs refuse them, so nobody can upload a stranger's
     * photo to "Anything" and get around the clothing rules.
     */
    allowsPeople?: boolean;
  };
  /** Empty for "anything": the vision model decides the parts per scene. */
  parts: PartDef[];
  /** Where products come from for this pack. */
  products: "catalog" | "live-search";
  /** Always sent as "do not change" in every edit for this pack. */
  locks: string[];
};
