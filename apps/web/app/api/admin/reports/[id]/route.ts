import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { decideReport } from "@/lib/server/reports";

const Body = z.object({ action: z.enum(["remove", "dismiss"]) });

/** Admin: delete a reported link for good, or put it back. */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/reports/[id]">) {
  const { id } = await params;
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const reportId = Number(id);
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!Number.isSafeInteger(reportId) || reportId < 1 || !parsed.success) {
    return Response.json({ success: false, error: "That request didn't look right." }, { status: 400 });
  }

  try {
    const result = await decideReport(reportId, parsed.data.action, auth.accounts);
    if (result === "not_found") return Response.json({ success: false, error: "That report is gone." }, { status: 404 });
    if (result === "closed") return Response.json({ success: false, error: "Someone already decided on this report." }, { status: 409 });
    return Response.json({ success: true, data: { id: reportId } });
  } catch (error) {
    console.error("[admin] report decision failed", reportId, error);
    return Response.json({ success: false, error: "Couldn't save that. Please try again." }, { status: 502 });
  }
}
