import { isCreditPackId } from "@retrofit/core";
import { z } from "zod";
import type { ApiResponse, CheckoutStart } from "@/lib/api";
import { getStripe, requireUser, siteOrigin } from "@/lib/server/accounts";
import { checkoutParams } from "@/lib/server/checkout";
import { clientKey, getServices } from "@/lib/server/services";

const Body = z.object({ pack: z.string().refine(isCreditPackId), returnTo: z.string().max(100).optional() });

/** Starts Stripe Checkout for a credit pack and returns the payment page URL. */
export async function POST(request: Request) {
  if (!(await getServices().checkoutLimit.check(clientKey(request))).allowed) {
    return Response.json({ success: false, error: "Too many tries. Please wait a bit." }, { status: 429 });
  }
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Pick a pack." }, { status: 400 });

  try {
    const params = checkoutParams({
      packId: parsed.data.pack,
      user: auth.user,
      origin: siteOrigin(request),
      returnTo: parsed.data.returnTo ?? "/",
    });
    const session = await getStripe().checkout.sessions.create(params);
    if (!session.url) throw new Error("Stripe returned no checkout URL");
    const body: ApiResponse<CheckoutStart> = { success: true, data: { url: session.url } };
    return Response.json(body);
  } catch (error) {
    console.error("[checkout] start failed", error);
    return Response.json({ success: false, error: "Payments aren't working right now. Please try again." }, { status: 502 });
  }
}
