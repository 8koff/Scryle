import { requireUser } from "@/lib/server/accounts";
import { handleReopen } from "@/lib/server/reopen";
import { clientKey, getServices } from "@/lib/server/services";
import { signPhoto } from "@/lib/server/signing";

const JOB_ID = /^[a-zA-Z0-9-]{8,80}$/;

/** "Swap more on this photo" from My renders. */
export async function POST(request: Request, { params }: RouteContext<"/api/renders/[id]/reopen">) {
  const { id } = await params;
  const s = getServices();
  if (!(await s.reopenLimit.check(clientKey(request))).allowed) {
    return Response.json({ success: false, error: "That's a lot for one hour. Please try again later." }, { status: 429 });
  }
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!JOB_ID.test(id)) return Response.json({ success: false, error: "That render isn't in your account." }, { status: 404 });

  try {
    const { status, body } = await handleReopen(id, {
      userId: auth.user.id,
      renders: auth.accounts.renders,
      upload: (bytes, type) => s.higgsfield.uploadBytes(bytes, type),
      sign: (claim) => signPhoto(claim, s.secret),
    });
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[renders] reopen failed", id, error);
    return Response.json({ success: false, error: "Couldn't open that photo. Please try again." }, { status: 502 });
  }
}
