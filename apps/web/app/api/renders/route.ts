import type { ApiResponse, RenderCard } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import { listRenderCards } from "@/lib/server/renders";

/** The signed-in user's saved renders, newest first, with short-lived picture links. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const renders = await listRenderCards(auth.user.id, auth.accounts.renders);
    const body: ApiResponse<{ renders: RenderCard[] }> = { success: true, data: { renders } };
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[renders] list failed", error);
    return Response.json({ success: false, error: "Couldn't load your renders. Please try again." }, { status: 502 });
  }
}
