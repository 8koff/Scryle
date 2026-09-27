import { clientKey, getServices } from "@/lib/server/services";
import { fetchImage, handleShare } from "@/lib/server/share";
import { renderCardPng } from "@/lib/server/share-render";

/** A before/after card (PNG) to post. Private: nothing is stored. */
export async function POST(request: Request) {
  const s = getServices();
  if (!(await s.shareCardLimit.check(clientKey(request))).allowed) {
    return Response.json({ success: false, error: "That's a lot of shares for one hour." }, { status: 429 });
  }
  const input = await request.json().catch(() => null);

  try {
    const checked = await handleShare(input, { secret: s.secret, status: (id) => s.higgsfield.status(id) });
    if (!checked.ok) return Response.json({ success: false, error: checked.error }, { status: checked.status });
    const [before, after] = await Promise.all([fetchImage(checked.beforeUrl), fetchImage(checked.afterUrl)]);
    const png = await renderCardPng(before, after, checked.aspect);
    return new Response(new Uint8Array(png), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[share] card failed", error);
    return Response.json({ success: false, error: "Couldn't make the picture. The photo may have expired." }, { status: 502 });
  }
}
