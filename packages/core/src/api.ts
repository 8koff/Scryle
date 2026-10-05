/**
 * Shapes of the API's requests and answers. Shared by the web app and the iOS app, so both
 * read the server the same way. Types only: nothing here runs.
 */
import type { PackId } from "./packs/types";
import type { SceneAnalysis } from "./scene/schema";

/** Every API route answers with this envelope. */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string; code?: ApiErrorCode };

/** Lets the app react to an error: show sign-in, show the credit packs, or confirm with Apple. */
export type ApiErrorCode = "sign_in" | "no_credits" | "apple_confirm" | "render_pending" | "render_conflict" | "render_unavailable" | "render_rejected";

/** One swap the person picked: a store product, or a text-only change (paint, tint, wall colour). */
export type SelectionInput = { partId: string; productId: string } | { partId: string; text: string };

export type ScanResult = {
  /** Public URL of the uploaded photo (temporary storage). */
  photoUrl: string;
  width: number;
  height: number;
  scene: SceneAnalysis;
  /** Server signature over the photo + analysis; renders must present it. */
  token: string;
};

export type RenderStart = { jobId: string; jobToken: string; costUsd: number; requestId?: string };

/** Recover a start request without submitting another provider job. */
export type RenderRequestStatus =
  | { requestId: string; state: "missing" | "pending" }
  | { requestId: string; state: "finished"; result: ApiResponse<RenderStart> };

export type RenderStatus = { status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string; imageUrl?: string };

export type CreditsInfo = { credits: number };

/** A finished purchase (Stripe on the web, Apple in the iOS app): the new balance and what was added. */
export type CheckoutDone = { credits: number; added: number; bonus?: number };

/** Your invite code and how many renders each person gets. */
export type InviteInfo = { code: string; reward: number };

/** One saved render on "My renders". The picture links are short-lived. */
export type RenderCard = {
  jobId: string;
  pack: PackId;
  width: number;
  height: number;
  labels: string[];
  selections: SelectionInput[];
  /** False for renders saved before part maps were kept. */
  canReopen: boolean;
  createdAt: string;
  beforeUrl: string;
  afterUrl: string;
};

/** What the studio needs to open a saved photo again, with a fresh signature. */
export type Reopened = {
  pack: PackId;
  photoUrl: string;
  width: number;
  height: number;
  scene: SceneAnalysis;
  token: string;
  /** The swaps from that render, picked again so the person can tweak them. */
  selections: SelectionInput[];
};
