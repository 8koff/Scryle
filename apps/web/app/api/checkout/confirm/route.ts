import { z } from "zod";
import type { ApiResponse, CheckoutDone } from "@/lib/api";
import { getStripe, requireUser } from "@/lib/server/accounts";
import { fulfillCheckout } from "@/lib/server/checkout";

const Body = z.object({ sessionId: z.string().regex(/^cs_[a-zA-Z0-9_]{10,200}$/) });

/**
 * Called when the buyer lands back on our site. Adds the credits straight away if the
 * webhook hasn't yet (and makes local testing work without webhooks).
 */
export async function POST(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Unknown payment." }, { status: 400 });

  try {
    const session = await getStripe().checkout.sessions.retrieve(parsed.data.sessionId);
    if (session.client_reference_id !== auth.user.id) {
      return Response.json({ success: false, error: "Unknown payment." }, { status: 404 });
    }
    const result = await fulfillCheckout(session, auth.accounts.credits);
    if (result.status === "invalid") {
      return Response.json({ success: false, error: "Something is wrong with this payment. Please contact us." }, { status: 409 });
    }
    const credits = await auth.accounts.credits.balance(auth.user.id);
    const body: ApiResponse<CheckoutDone> = { success: true, data: { credits, added: result.added, ...(result.bonus ? { bonus: result.bonus } : {}) } };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[checkout] confirm failed", error);
    return Response.json({ success: false, error: "Couldn't check your payment yet. Refresh in a moment." }, { status: 502 });
  }
}
