import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdminStats, GalleryCard, ReportCard } from "@/lib/api";
import { getAccounts } from "./accounts";
import type { Report } from "./reports";
import type { ShareRecord, ShareStore } from "./shares";

export const toGalleryCard = (share: ShareRecord, shares: ShareStore): GalleryCard => ({
  id: share.id,
  pack: share.pack,
  width: share.width,
  height: share.height,
  labels: share.labels,
  gallery: share.gallery,
  beforeUrl: shares.fileUrl(share.id, "before"),
  afterUrl: shares.fileUrl(share.id, "after"),
});

/** Open reports with the pictures they are about (each link read once). */
export async function toReportCards(reports: Report[], shares: ShareStore): Promise<ReportCard[]> {
  const ids = [...new Set(reports.map((r) => r.shareId))];
  const found = new Map(await Promise.all(ids.map(async (id) => [id, await shares.get(id)] as const)));
  return reports.map((r) => {
    const share = found.get(r.shareId);
    return {
      id: r.id,
      shareId: r.shareId,
      reason: r.reason,
      details: r.details,
      contact: r.contact,
      createdAt: r.createdAt,
      link: share
        ? { hidden: share.hidden, beforeUrl: shares.fileUrl(share.id, "before"), afterUrl: shares.fileUrl(share.id, "after") }
        : null,
    };
  });
}

const HOME_LIMIT = 12;

/** Approved pictures for the home page. Empty (and the section hidden) if anything goes wrong. */
export const loadGallery = cache(async (): Promise<GalleryCard[]> => {
  try {
    const { shares } = getAccounts();
    return (await shares.listGallery("approved", HOME_LIMIT)).map((s) => toGalleryCard(s, shares));
  } catch (error) {
    console.error("[gallery] load failed", error);
    return [];
  }
});

export async function adminStats(db: SupabaseClient): Promise<AdminStats> {
  const { data, error } = await db.rpc("admin_stats").single<{
    spent_today_usd: number | string;
    renders_7d: number | string;
    purchases_7d: number | string;
    credits_sold_7d: number | string;
    pending_gallery: number | string;
  }>();
  if (error || !data) throw new Error(`[admin] stats failed: ${error?.message}`);
  return {
    spentTodayUsd: Number(data.spent_today_usd),
    renders7d: Number(data.renders_7d),
    purchases7d: Number(data.purchases_7d),
    creditsSold7d: Number(data.credits_sold_7d),
    pendingGallery: Number(data.pending_gallery),
  };
}
