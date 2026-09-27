import { cache } from "react";
import { getAccounts } from "./accounts";
import { SHARE_ID, type ShareRecord } from "./shares";

export type SharePageData = ShareRecord & { beforeUrl: string; afterUrl: string; cardUrl: string };

/** One share link for the page and its preview image (read once per request). */
export const loadShare = cache(async (id: string): Promise<SharePageData | null> => {
  if (!SHARE_ID.test(id)) return null;
  try {
    const { shares } = getAccounts();
    const share = await shares.get(id);
    // A hidden link (serious report, waiting for an admin) looks deleted to everyone.
    if (!share || share.hidden) return null;
    return { ...share, beforeUrl: shares.fileUrl(id, "before"), afterUrl: shares.fileUrl(id, "after"), cardUrl: shares.fileUrl(id, "card") };
  } catch (error) {
    console.error("[share page] load failed", id, error);
    return null;
  }
});

/** "Black leather bomber jacket + Cargo trousers" */
export const swapTitle = (labels: string[]) => (labels.length ? labels.join(" + ") : "A new look");
