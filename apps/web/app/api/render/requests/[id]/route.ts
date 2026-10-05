import { z } from "zod";
import type { ApiResponse, RenderRequestStatus } from "@retrofit/core";
import { getAdminDb, requireUser } from "@/lib/server/accounts";
import { createSupabaseRenderRequestStore } from "@/lib/server/render-requests";
import { clientKey, getServices } from "@/lib/server/services";

/** Read-only recovery and capability check. Never starts a job or spends a credit. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return Response.json({ success: false, error: "Invalid request." }, { status: 400 });
  const headers = { "Cache-Control": "no-store" };
  try {
    // Reuse the existing read limiter with a separate key; no paid-render allowance is consumed.
    const limit = await getServices().shopProductsLimit.check(`render-recovery:${clientKey(request)}:${auth.user.id}`);
    if (!limit.allowed) {
      return Response.json({ success: false, error: "Please wait before checking again." }, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSec) } });
    }
    const row = await createSupabaseRenderRequestStore(getAdminDb()).get(auth.user.id, id);
    const data: RenderRequestStatus = row?.result
      ? { requestId: id, state: "finished", result: row.result.body }
      : { requestId: id, state: row ? "pending" : "missing" };
    return Response.json({ success: true, data } satisfies ApiResponse<RenderRequestStatus>, { headers });
  } catch {
    return Response.json({ success: false, error: "Couldn't check this swap yet.", code: "render_unavailable" }, { status: 503, headers });
  }
}
