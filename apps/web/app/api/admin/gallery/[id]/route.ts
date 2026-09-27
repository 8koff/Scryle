import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin";
import { SHARE_ID } from "@/lib/server/shares";

const Body = z.object({ decision: z.enum(["approved", "rejected"]) });

/** Admin: put a link on the home page, or say no (also takes a live one down). */
export async function POST(request: Request, { params }: RouteContext<"/api/admin/gallery/[id]">) {
  const { id } = await params;
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!SHARE_ID.test(id) || !parsed.success) return Response.json({ success: false, error: "That request didn't look right." }, { status: 400 });
  try {
    const found = await auth.accounts.shares.setGallery(id, parsed.data.decision);
    if (!found) return Response.json({ success: false, error: "That link is gone." }, { status: 404 });
    return Response.json({ success: true, data: { id, gallery: parsed.data.decision } });
  } catch (error) {
    console.error("[admin] gallery decision failed", id, error);
    return Response.json({ success: false, error: "Couldn't save that. Please try again." }, { status: 502 });
  }
}
