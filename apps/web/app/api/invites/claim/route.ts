import type { ApiResponse } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import type { InviteClaim } from "@/lib/server/credits";
import { claimInviteCode } from "@/lib/server/invites";

/** A newly signed-in account says who invited it. Only new accounts count (checked in the database). */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const input = (await request.json().catch(() => null)) as { code?: unknown } | null;
  try {
    const result = await claimInviteCode(auth.user.id, input?.code, auth.accounts.credits);
    const body: ApiResponse<{ result: InviteClaim }> = { success: true, data: { result } };
    return Response.json(body);
  } catch (error) {
    console.error("[invites] claim failed", error);
    return Response.json({ success: false, error: "Couldn't save the invite." }, { status: 502 });
  }
}
