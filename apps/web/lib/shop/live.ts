import { isPackId, type PackId } from "@retrofit/core";
import { z } from "zod";
import type { Product } from "@/lib/catalog/catalog";

/** Ids of products found by store search. Catalog ids can't start with "live-". */
export const LIVE_ID = /^live-[a-f0-9]{20}$/;
export const isLiveId = (id: string) => LIVE_ID.test(id);

/**
 * Product photos we accept from store search: Google's shopping thumbnails and SerpApi's
 * copies. The server downloads these for renders, so it must never fetch any other host.
 */
const IMAGE_HOSTS = [/^encrypted-tbn\d\.gstatic\.com$/, /^serpapi\.com$/];

export function isTrustedImage(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && !url.username && !url.password && !url.port && IMAGE_HOSTS.some((h) => h.test(url.hostname));
  } catch {
    return false;
  }
}

/** Clothing searches: whose clothes to look for. */
export const FITS = ["women", "men", "any"] as const;
export type Fit = (typeof FITS)[number];

/** A found product as the browser sees it. No store link: /go/<id> looks that up on the server. */
export type LiveProduct = Product & { kind: "live"; priceCents: number; store: string; image: string };

export const LiveProductSchema = z.object({
  id: z.string().regex(LIVE_ID),
  pack: z.string().refine(isPackId, "unknown pack"),
  part: z.string().min(1).max(60),
  title: z.string().min(1).max(200),
  priceCents: z.number().int().positive().max(10_000_000),
  store: z.string().min(1).max(80),
  image: z.string().refine(isTrustedImage, "untrusted image"),
});

/** Checks a found product from an untrusted place (the network, local storage). */
export function parseLiveProduct(raw: unknown): LiveProduct | null {
  const parsed = LiveProductSchema.safeParse(raw);
  if (!parsed.success) return null;
  return { ...parsed.data, pack: parsed.data.pack as PackId, kind: "live" };
}
