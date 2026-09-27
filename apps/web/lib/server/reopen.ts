import type { PackId, SceneAnalysis } from "@retrofit/core";
import { imageSize } from "image-size";
import type { ApiResponse, Reopened } from "@/lib/api";
import type { RenderStore } from "./renders";

export type ReopenDeps = {
  userId: string;
  renders: RenderStore;
  /** Puts the photo where the image model can read it; returns its public URL. */
  upload: (bytes: Uint8Array, contentType: string) => Promise<string>;
  sign: (claim: { photoUrl: string; pack: PackId; width: number; height: number; scene: SceneAnalysis }) => string;
};

type Result = { status: number; body: ApiResponse<Reopened> };
const fail = (status: number, error: string): Result => ({ status, body: { success: false, error } });

/**
 * Opens a saved render's photo in the studio again. Uses our own stored copy (Higgsfield's may
 * be gone) and only for the person who paid for it. Nothing here costs money.
 */
export async function handleReopen(jobId: string, deps: ReopenDeps): Promise<Result> {
  const render = await deps.renders.get(jobId);
  if (!render || render.owner !== deps.userId) return fail(404, "That swap isn't in your account.");
  if (!render.keptAt || !render.scene) return fail(409, "This swap can't be opened again. Take a new photo instead.");

  const bytes = await deps.renders.download(render, "before");
  const { width, height } = imageSize(bytes);
  if (!width || !height) return fail(500, "Couldn't read the saved photo.");

  const photoUrl = await deps.upload(bytes, "image/jpeg");
  const claim = { photoUrl, pack: render.pack, width, height, scene: render.scene };
  return {
    status: 200,
    body: { success: true, data: { ...claim, token: deps.sign(claim), selections: render.selections } },
  };
}
