import type { PackId } from "@retrofit/core";

type Cover = {
  /** The photo as it was. */
  before: number;
  /** A real AI render of the same photo, or none (then only `before` is shown). */
  after?: number;
  examples: string;
};

/**
 * One example swap per category, from the web's demo photos (apps/web/lib/demo.ts). All people
 * in them are AI-generated stand-ins; every "after" is a real render and is labelled as an AI edit.
 */
export const PACK_COVERS: Record<PackId, Cover> = {
  // The try-on woman's date-night look (web: TRY_ON_DEMO / HERO_DEMO.person).
  clothing: {
    before: require("../../assets/demos/tryon-base.jpg"),
    after: require("../../assets/demos/tryon-date.jpg"),
    examples: "Dresses, shirts, jeans, sneakers, bags",
  },
  car: {
    before: require("../../assets/demos/wheel-before.jpg"),
    after: require("../../assets/demos/wheel-after.jpg"),
    examples: "Wheels, paint, tint, lights, ride height",
  },
  room: {
    before: require("../../assets/demos/room-before.jpg"),
    after: require("../../assets/demos/room-after.jpg"),
    examples: "Sofas, rugs, lamps, wall colour",
  },
  anything: { before: require("../../assets/covers/anything.jpg"), examples: "Bikes, desks, gardens, gear" },
};
