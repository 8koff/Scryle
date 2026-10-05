import { z } from "zod";
import { getAccounts } from "@/lib/server/accounts";
import { getAppleVerifier, handleAppleNotification } from "@/lib/server/apple";

/** Checking with Apple's certificate service can take a while on a cold start. */
export const maxDuration = 60;

const Body = z.object({ signedPayload: z.string().min(20).max(100_000) });

/**
 * App Store Server Notifications v2 (set this URL in App Store Connect). Apple signs every
 * notification; only a verified refund or revoke changes anything. A non-200 answer makes
 * Apple send it again later.
 */
export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ success: false, error: "Bad notification." }, { status: 400 });

  try {
    const result = await handleAppleNotification(parsed.data.signedPayload, {
      verify: getAppleVerifier(),
      credits: getAccounts().credits,
    });
    if (result.status === "invalid") return Response.json({ success: false, error: "Bad notification." }, { status: 400 });
    if (result.status === "retry") return Response.json({ success: false, error: "Try again later." }, { status: 503 });
    if (result.status === "reversed") console.info("[apple] refund took back", result.removed, "credits");
    return Response.json({ success: true, data: { status: result.status } });
  } catch (error) {
    console.error("[apple] notification failed", error);
    return Response.json({ success: false, error: "Try again later." }, { status: 500 });
  }
}
