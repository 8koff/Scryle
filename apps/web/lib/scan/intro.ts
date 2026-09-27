import type { StaticImageData } from "next/image";
import type { PackId } from "@retrofit/core";
import { DEMO } from "@/lib/demo";

export type PackIntro = {
  title: string;
  tips: string[];
  image: StaticImageData;
  imagePosition?: string;
};

/** What each category's pre-camera screen says. */
export const INTROS: Record<PackId, PackIntro> = {
  clothing: {
    title: "A full-body photo",
    tips: [
      "Lean your phone against something at waist height.",
      "Step back until your whole body fits the outline.",
      "Hold still. It counts down from five and takes the photo.",
    ],
    image: DEMO.person.before,
  },
  car: {
    title: "Your car, front three-quarter",
    tips: [
      "Stand at a front corner of the car.",
      "Fit the whole car in the frame, wheels included.",
      "Hold steady and it takes the photo for you.",
    ],
    image: DEMO.wheel.before,
  },
  room: {
    title: "A wide shot of the room",
    tips: [
      "Stand in a corner so you see most of the room.",
      "Hold the phone upright at chest height.",
      "Keep still for a second while it takes the photo.",
    ],
    image: DEMO.room.before,
    imagePosition: "45% 50%",
  },
  anything: {
    title: "Anything you want to change",
    tips: [
      "Put the thing in the middle of the frame.",
      "Get close enough that it fills most of the picture.",
      "Hold still and it takes the photo.",
    ],
    image: DEMO.object,
  },
};
