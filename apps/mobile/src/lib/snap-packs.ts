import { PACKS, type Pack } from "@retrofit/core";

/**
 * The categories a photo from the Home camera can go to. Library photos only go where uploads
 * are allowed, and Clothing is never one: it needs the 18+ check and its own live camera.
 */
export function packsFor(source: "camera" | "library"): Pack[] {
  return PACKS.filter((p) => !p.capture.requireAdult && (source === "camera" || p.capture.allowUpload));
}
