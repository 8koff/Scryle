import { z } from "zod";
import type { ApiResponse, CheckoutDone } from "@/lib/api";
import { requireUser } from "@/lib/server/accounts";
import { fulfillApplePurchase, getAppleVerifier, sandboxPolicyFromEnv } from "@/lib/server/apple";
import { clientKey, getServices } from "@/lib/server/services";

/** Checking with Apple's certificate service can take a while on a cold start. */
export const maxDuration = 60;

/** Apple's signed transaction (a JWS). Real ones are a few KB. */
const Body = z.object({ signedTransaction: z.string().min(20).max(20_000) });

/**
 * The iOS app calls this after an App Store purchase, with Apple's signed transaction.
 * The app finishes the transaction with Apple only after this succeeds, so a failed call is
 * sent again on the next app start and the credits are never lost.
 */
export async function POST(request: Request) {
  if (!(await getServices().checkoutLimit.check(clientKey(request))).allowed) {
    return Response.json({ success: false, error: "Too many tries. Please wait a bit." }, { status: 429 });
  }
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Unknown purchase." }, { status: 400 });

  try {
    const result = await fulfillApplePurchase(parsed.data.signedTransaction, auth.user, {
      verify: getAppleVerifier(),
      credits: auth.accounts.credits,
      sandbox: sandboxPolicyFromEnv(),
    });
    if (result.status === "retry") {
      return Response.json({ success: false, error: "Couldn't check your purchase yet. It will be tried again." }, { status: 503 });
    }
    if (result.status === "invalid") {
      return Response.json({ success: false, error: "We couldn't match this purchase to your account. Please contact us." }, { status: 409 });
    }
    const credits = await auth.accounts.credits.balance(auth.user.id);
    const body: ApiResponse<CheckoutDone> = { success: true, data: { credits, added: result.added, ...(result.bonus ? { bonus: result.bonus } : {}) } };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[apple] purchase failed", error);
    return Response.json({ success: false, error: "Couldn't check your purchase yet. It will be tried again." }, { status: 502 });
  }
}
