import { z } from "zod";
import { requireUser } from "@/lib/server/accounts";
import { ownerGalleryChange, SHARE_ID } from "@/lib/server/shares";

const Body = z.object({ action: z.enum(["submit", "withdraw"]) });

/** The owner sends their link to the gallery queue, or takes it out. */
export async function POST(request: Request, { params }: RouteContext<"/api/shares/[id]/gallery">) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!SHARE_ID.test(id) || !parsed.success) return Response.json({ success: false, error: "That request didn't look right." }, { status: 400 });

  try {
    const share = await auth.accounts.shares.get(id);
    if (!share || share.owner !== auth.user.id) {
      return Response.json({ success: false, error: "Only the person who made this link can do that." }, { status: 403 });
    }
    const next = ownerGalleryChange(share.gallery, parsed.data.action);
    if (next) await auth.accounts.shares.setGallery(id, next, auth.user.id);
    return Response.json({ success: true, data: { gallery: next ?? share.gallery } });
  } catch (error) {
    console.error("[gallery] owner change failed", id, error);
    return Response.json({ success: false, error: "Couldn't update the gallery. Please try again." }, { status: 502 });
  }
}
