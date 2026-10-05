import { after } from "next/server";
import type { ApiResponse, RenderCard } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import { backfillThumbs, listRenderCards } from "@/lib/server/renders";
import { jpegThumb } from "@/lib/server/thumbs";

/** The signed-in user's saved renders, newest first, with short-lived picture links. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const renders = await listRenderCards(auth.user.id, auth.accounts.renders);
    const missing = renders.filter((r) => !r.thumbUrl).map((r) => r.jobId);
    // Older renders have no small preview yet: make a few after answering, for next time.
    if (missing.length) after(() => backfillThumbs(auth.user.id, missing, { renders: auth.accounts.renders, thumb: jpegThumb }));
    const body: ApiResponse<{ renders: RenderCard[] }> = { success: true, data: { renders } };
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[renders] list failed", error);
    return Response.json({ success: false, error: "Couldn't load your renders. Please try again." }, { status: 502 });
  }
}
