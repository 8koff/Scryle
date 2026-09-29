import type { PackId } from "@retrofit/core";
import type { ReportReason } from "@/lib/reports";

// Types the iOS app also reads live in @retrofit/core.
export type {
  ApiErrorCode,
  ApiResponse,
  CreditsInfo,
  InviteInfo,
  RenderCard,
  RenderStart,
  RenderStatus,
  Reopened,
  ScanResult,
} from "@retrofit/core";

export type CheckoutStart = { url: string };

export type CheckoutDone = { credits: number; added: number; bonus?: number };

/** Where a share link stands with the home page gallery. Only "approved" is ever shown. */
export type GalleryStatus = "none" | "pending" | "approved" | "rejected";

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
