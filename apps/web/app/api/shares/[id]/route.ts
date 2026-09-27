import { requireUser } from "@/lib/server/accounts";
import { SHARE_ID } from "@/lib/server/shares";

/** Is this link mine? Lets the page show "Delete this link" and the gallery button to its owner only. */
export async function GET(request: Request, { params }: RouteContext<"/api/shares/[id]">) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!SHARE_ID.test(id)) return Response.json({ success: false, error: "Unknown link." }, { status: 404 });
  try {
    const share = await auth.accounts.shares.get(id);
    const isOwner = share?.owner === auth.user.id;
    // The gallery status is only told to the owner.
    const data = { isOwner, ...(isOwner && share ? { gallery: share.gallery } : {}) };
    return Response.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[shares] owner check failed", error);
    return Response.json({ success: false, error: "Couldn't check this link." }, { status: 502 });
  }
}

/** Deletes the link and its photos. Owner only. */
export async function DELETE(request: Request, { params }: RouteContext<"/api/shares/[id]">) {
  const { id } = await params;
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!SHARE_ID.test(id)) return Response.json({ success: false, error: "Unknown link." }, { status: 404 });
  try {
    const removed = await auth.accounts.shares.remove(id, auth.user.id);
    if (!removed) return Response.json({ success: false, error: "Only the person who made this link can delete it." }, { status: 403 });
    return Response.json({ success: true, data: { id } });
  } catch (error) {
    console.error("[shares] delete failed", error);
    return Response.json({ success: false, error: "Couldn't delete the link. Please try again." }, { status: 502 });
  }
}
