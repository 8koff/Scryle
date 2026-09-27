import { clientKey, getServices } from "@/lib/server/services";
import { handleShopSearch } from "@/lib/server/shop/search";

/** Real products for one part of a scanned photo. */
export async function POST(request: Request) {
  const s = getServices();
  const visitor = clientKey(request);
  const { allowed, retryAfterSec } = await s.shopSearchLimit.check(visitor);
  if (!allowed) {
    return Response.json(
      { success: false, error: "That's a lot of searches for one hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  const input: unknown = await request.json().catch(() => null);
  const { status, body } = await handleShopSearch(input, {
    secret: s.secret,
    store: s.shop.store,
    api: s.shop.api,
    takeSearch: () => s.shop.takeSearch(visitor),
  });
  return Response.json(body, { status });
}
