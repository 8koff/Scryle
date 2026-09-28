import type { StaticImageData } from "next/image";
import type { PackId } from "@retrofit/core";
import { DEMO } from "@/lib/demo";

/** One picture and a few example parts per category, for the category list and the app's category switch. */
export const PACK_COVERS: Record<PackId, { image: StaticImageData; position?: string; examples: string }> = {
  clothing: { image: DEMO.person.outfit, position: "50% 25%", examples: "Dresses, shirts, jeans, sneakers, bags" },
  car: { image: DEMO.wheel.after, examples: "Wheels, paint, tint, lights, ride height" },
  room: { image: DEMO.room.after, position: "58% 62%", examples: "Sofas, rugs, lamps, wall colour" },
  anything: { image: DEMO.object, examples: "Bikes, desks, gardens, gear" },
};
