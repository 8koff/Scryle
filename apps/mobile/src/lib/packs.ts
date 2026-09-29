import type { PackId } from "@retrofit/core";

/** One picture and a few example parts per category (same as the web's PACK_COVERS). */
export const PACK_COVERS: Record<PackId, { image: number; examples: string }> = {
  clothing: { image: require("../../assets/covers/clothing.jpg"), examples: "Dresses, shirts, jeans, sneakers, bags" },
  car: { image: require("../../assets/covers/car.jpg"), examples: "Wheels, paint, tint, lights, ride height" },
  room: { image: require("../../assets/covers/room.jpg"), examples: "Sofas, rugs, lamps, wall colour" },
  anything: { image: require("../../assets/covers/anything.jpg"), examples: "Bikes, desks, gardens, gear" },
};

/** Until in-app buying ships (part 4 of the iOS plan). Shown by every Buy button. */
export const BUY_SOON = {
  title: "Buying swaps is coming soon",
  body: "You'll be able to buy swaps in the app in the next update.",
};

/** Until the camera ships (part 2 of the iOS plan). */
export const CAMERA_SOON = {
  title: "The camera is coming next",
  body: "Taking a photo and swapping arrives in the next update.",
};
