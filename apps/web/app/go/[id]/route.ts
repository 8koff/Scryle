import { findProduct, isBuyable } from "@/lib/catalog/catalog";
import { clientKey, getServices } from "@/lib/server/services";
import { resolveStoreLink } from "@/lib/server/shop/go";
import { affiliateConfigFromEnv, affiliateUrl } from "@/lib/shop/affiliate";
import { isLiveId } from "@/lib/shop/live";

const config = affiliateConfigFromEnv();

const redirect = (location: string) =>
  new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "origin" },
  });
const notFound = () => new Response("Unknown product", { status: 404 });

/** A found product: its store page (looked up once), else Google's page listing every store. */
async function liveTarget(id: string, visitor: string): Promise<string | null> {
  const s = getServices();
  const [product] = await s.shop.store.getMany([id]);
  if (!product) return null;
  const { url, isStore } = await resolveStoreLink(product, {
    store: s.shop.store,
    api: s.shop.api,
    takeSearch: () => s.shop.takeSearch(visitor),
  });
  console.info("[go] click", { product: product.id, store: product.store, isStore });
  return (isStore ? affiliateUrl(url, config) : null) ?? product.googleLink;
}

/**
 * "Buy at <store>": sends the shopper to the store with our referral tag. Only products in
 * our catalog or found by our own search can be linked, so this can't send people anywhere else.
 */
export async function GET(request: Request, { params }: RouteContext<"/go/[id]">) {
  const { id } = await params;
  if (isLiveId(id)) {
    const visitor = clientKey(request);
    if (!(await getServices().goLimit.check(visitor)).allowed) {
      return new Response("Too many store links for one hour. Please try again later.", { status: 429 });
    }
    try {
      const target = await liveTarget(id, visitor);
      return target ? redirect(target) : notFound();
    } catch (error) {
      console.error("[go] live lookup failed", id, error);
      return new Response("Couldn't open the store. Please try again.", { status: 502 });
    }
  }

  const product = findProduct(id);
  const target = isBuyable(product) && product.buyUrl ? affiliateUrl(product.buyUrl, config) : null;
  if (!product || !target) return notFound();
  console.info("[go] click", { product: product.id, store: product.store });
  return redirect(target);
}
