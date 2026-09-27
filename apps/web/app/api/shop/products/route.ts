import { clientKey, getServices } from "@/lib/server/services";
import { toPublic } from "@/lib/server/shop/products";
import { isLiveId } from "@/lib/shop/live";

const MAX_IDS = 12;

/**
 * Found products by id, for swaps that came from someone else ("Try this on me", a shared
 * link). Only public fields: never the store links.
 */
export async function GET(request: Request) {
  const s = getServices();
  const { allowed, retryAfterSec } = await s.shopProductsLimit.check(clientKey(request));
  if (!allowed) {
    return Response.json(
      { success: false, error: "Too many requests. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") ?? "").split(",").filter(isLiveId))].slice(0, MAX_IDS);
  if (!ids.length) return Response.json({ success: true, data: [] });
  try {
    const products = await s.shop.store.getMany(ids);
    return Response.json({ success: true, data: products.map(toPublic) }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("[shop] product lookup failed", error);
    return Response.json({ success: false, error: "Couldn't load those products." }, { status: 502 });
  }
}
