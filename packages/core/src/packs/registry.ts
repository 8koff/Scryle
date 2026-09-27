import { anythingPack } from "./anything";
import { carPack } from "./car";
import { clothingPack } from "./clothing";
import { roomPack } from "./room";
import type { Pack, PackId } from "./types";

/** Home-screen order. Adding a category = one new pack file + one line here. */
export const PACKS: readonly Pack[] = [clothingPack, carPack, roomPack, anythingPack];

export function getPack(id: string): Pack {
  const pack = PACKS.find((p) => p.id === id);
  if (!pack) throw new Error(`Unknown pack "${id}"`);
  return pack;
}

export function isPackId(id: string): id is PackId {
  return PACKS.some((p) => p.id === id);
}
