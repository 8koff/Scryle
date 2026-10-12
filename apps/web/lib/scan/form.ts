import type { PackId } from "@retrofit/core";

/** The signed-out website sends an explicit Allow with each scan; Clothing also needs the 18+ answer. */
export function scanForm(pack: PackId, photo: Blob, hasAllowedAi: boolean, isAdultConfirmed: boolean): FormData {
  const form = new FormData();
  form.append("pack", pack);
  form.append("photo", photo, "photo.jpg");
  if (hasAllowedAi) form.append("ai_consent", "yes");
  if (isAdultConfirmed) form.append("adult", "yes");
  return form;
}
