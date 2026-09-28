import { FREE_RENDERS } from "@retrofit/core";
import type { ApiResponse, CreditsInfo } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";

/** The signed-in user's balance. The first call ever also gives the free render. */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const credits = await auth.accounts.credits.grantWelcome(auth.user.id, FREE_RENDERS);
    const body: ApiResponse<CreditsInfo> = { success: true, data: { credits } };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[credits] balance failed", error);
    return Response.json({ success: false, error: "Couldn't load your pictures. Please try again." }, { status: 502 });
  }
}
