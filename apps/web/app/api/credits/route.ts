import type { ApiResponse, CreditsInfo } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import { planInfo } from "@/lib/server/subscriptions";

/** The signed-in user's swaps left this month and their plan. There is no free swap (2026-10-10). */
export async function GET(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const [credits, sub] = await Promise.all([auth.accounts.credits.balance(auth.user.id), auth.accounts.subscriptions.get(auth.user.id)]);
    const body: ApiResponse<CreditsInfo> = { success: true, data: { credits, plan: planInfo(sub, new Date()) } };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[credits] balance failed", error);
    return Response.json({ success: false, error: "Couldn't load your pictures. Please try again." }, { status: 502 });
  }
}
