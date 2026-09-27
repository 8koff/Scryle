import { getPack, isPackId, type Pack, type SceneAnalysis } from "@retrofit/core";
import { imageSize } from "image-size";
import type { ApiResponse, ScanResult } from "@/lib/api";

export const MAX_PHOTO_BYTES = 12 * 1024 * 1024;

/** What one photo read is booked at against the daily cap. A real read costs about 4 cents. */
export const SCAN_COST_USD = 0.05;
/** Photo reading may use at most this part of the daily cap; the rest is kept for paid renders. */
export const SCAN_CAP_SHARE = 0.5;

const PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export type ScanDeps = {
  /** Stores the photo somewhere the AI providers can read it; returns a public URL. */
  upload: (bytes: Uint8Array, contentType: string) => Promise<string>;
  analyze: (pack: Pack, photoUrl: string) => Promise<SceneAnalysis>;
  /** Signs what we just produced so the render step can trust it. */
  sign: (claim: { photoUrl: string; pack: Pack["id"]; width: number; height: number; scene: SceneAnalysis }) => string;
  /** Books one read against the daily cap. False when today's budget for reading is used up. */
  reserve: () => Promise<boolean>;
  /** Gives the booking back when the photo was never read. */
  release: () => Promise<void>;
};

type Result = { status: number; body: ApiResponse<ScanResult> };

const fail = (status: number, error: string): Result => ({ status, body: { success: false, error } });

/** Validates the upload, stores the photo and asks the photo reader what can be swapped. */
export async function handleScan(form: FormData, deps: ScanDeps): Promise<Result> {
  const packId = form.get("pack");
  if (typeof packId !== "string" || !isPackId(packId)) return fail(400, "Unknown category.");
  const pack = getPack(packId);

  if (pack.capture.requireAdult && form.get("adult") !== "yes") {
    return fail(400, "Please confirm you are 18 or older.");
  }

  const photo = form.get("photo");
  if (!(photo instanceof Blob) || photo.size === 0) return fail(400, "No photo was sent.");
  if (!PHOTO_TYPES.has(photo.type)) return fail(400, "Please use a JPEG, PNG or WebP photo.");
  if (photo.size > MAX_PHOTO_BYTES) return fail(413, "That photo is too large. Please use one under 12 MB.");

  const bytes = new Uint8Array(await photo.arrayBuffer());
  let size: { width?: number; height?: number };
  try {
    size = imageSize(bytes);
  } catch {
    return fail(400, "That file doesn't look like a photo.");
  }
  const { width, height } = size;
  if (!width || !height) return fail(400, "That file doesn't look like a photo.");

  let isReserved = false;
  let hasStartedReading = false;
  try {
    // Fails closed: if the cap can't be checked, this throws and nothing is read.
    isReserved = await deps.reserve();
    if (!isReserved) return fail(503, "We've read a lot of photos today. Please try again tomorrow.");
    const photoUrl = await deps.upload(bytes, photo.type);
    hasStartedReading = true;
    const scene = await deps.analyze(pack, photoUrl);
    // No token for a person outside Clothing: without one, the render step refuses the photo.
    if (scene.hasPerson && !pack.capture.allowsPeople) return fail(422, PERSON_REFUSED);
    const token = deps.sign({ photoUrl, pack: pack.id, width, height, scene });
    return { status: 200, body: { success: true, data: { photoUrl, width, height, scene, token } } };
  } catch (error) {
    console.error("[scan] provider error", error);
    if (isReserved && !hasStartedReading) await deps.release().catch((e) => console.error("[scan] spend release failed", e));
    return fail(502, "We couldn't read that photo right now. Please try again.");
  }
}

export const PERSON_REFUSED =
  "This photo has a person in it. People can only be changed in Clothing, with a live photo of yourself. Please take the photo again with no one in it.";
