import type { PackId, SceneAnalysis } from "@retrofit/core";
import type { SelectionInput } from "@/lib/build/store";
import type { ReportReason } from "@/lib/reports";

/** Every API route answers with this envelope. */
export type ApiResponse<T> = { success: true; data: T } | { success: false; error: string; code?: ApiErrorCode };

/** Lets the browser react to an error: show sign-in, or show the credit packs. */
export type ApiErrorCode = "sign_in" | "no_credits";

export type ScanResult = {
  /** Public URL of the uploaded photo (temporary storage). */
  photoUrl: string;
  width: number;
  height: number;
  scene: SceneAnalysis;
  /** Server signature over the photo + analysis; renders must present it. */
  token: string;
};

export type RenderStart = { jobId: string; jobToken: string; costUsd: number };

export type RenderStatus = { status: "queued" | "in_progress" | "completed" | "failed" | "nsfw" | "canceled" | string; imageUrl?: string };

export type CreditsInfo = { credits: number };

export type CheckoutStart = { url: string };

export type CheckoutDone = { credits: number; added: number; bonus?: number };

/** Your invite code and how many renders each person gets. */
export type InviteInfo = { code: string; reward: number };

/** Where a share link stands with the home page gallery. Only "approved" is ever shown. */
export type GalleryStatus = "none" | "pending" | "approved" | "rejected";

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

/** One picture in the gallery (or the admin queue). The files are the share link's own. */
export type GalleryCard = {
  id: string;
  pack: PackId;
  width: number;
  height: number;
  labels: string[];
  gallery: GalleryStatus;
  beforeUrl: string;
  afterUrl: string;
};

/** One open report for the admin page. `link` is null once the link is gone. */
export type ReportCard = {
  id: number;
  shareId: string;
  reason: ReportReason;
  details: string;
  contact: string;
  createdAt: string;
  link: { hidden: boolean; beforeUrl: string; afterUrl: string } | null;
};

/** Numbers for the admin page. */
export type AdminStats = {
  spentTodayUsd: number;
  renders7d: number;
  purchases7d: number;
  creditsSold7d: number;
  pendingGallery: number;
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
