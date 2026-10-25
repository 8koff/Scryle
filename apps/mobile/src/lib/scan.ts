import type { ApiResponse, PackId, ScanResult } from "@retrofit/core";
import { OFFLINE, withTimeout } from "./api";
import type { Photo } from "./photo";
import { account } from "./use-account";

export type ScanOutcome = { status: "ready"; data: ScanResult } | { status: "error"; message: string };

/** The form /api/scan reads. `adult` is only sent after the 18+ confirmation. */
export function scanForm(pack: PackId, photo: Photo, isAdultConfirmed: boolean): FormData {
  const form = new FormData();
  form.append("pack", pack);
  // React Native's FormData sends a local file from this shape.
  form.append("photo", { uri: photo.uri, name: "photo.jpg", type: "image/jpeg" } as unknown as Blob);
  if (isAdultConfirmed) form.append("adult", "yes");
  return form;
}

/**
 * Sends the photo to the server, which reads it and signs it. The server refuses people in
 * every category but Clothing, and needs `adult` for Clothing.
 */
export async function scanPhoto(pack: PackId, photo: Photo, isAdultConfirmed: boolean): Promise<ScanOutcome> {
  try {
    const body = await withTimeout(async (signal) => {
      const response = await account.authFetch("/api/scan", { method: "POST", body: scanForm(pack, photo, isAdultConfirmed), signal });
      return (await response.json()) as ApiResponse<ScanResult>;
    });
    return body.success ? { status: "ready", data: body.data } : { status: "error", message: body.error };
  } catch {
    return { status: "error", message: OFFLINE };
  }
}
