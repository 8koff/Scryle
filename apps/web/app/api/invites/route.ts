import { INVITE_RENDERS } from "@retrofit/core";
import type { ApiResponse, InviteInfo } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import { inviteCodeFor } from "@/lib/server/invites";

/** The signed-in user's invite code (made on first use). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const code = await inviteCodeFor(auth.user.id, auth.accounts.credits);
    const body: ApiResponse<InviteInfo> = { success: true, data: { code, reward: INVITE_RENDERS } };
    return Response.json(body, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("[invites] code failed", error);
    return Response.json({ success: false, error: "Couldn't load your invite link. Please try again." }, { status: 502 });
  }
}
