import { getAdminDb, NOT_SET_UP } from "@/lib/server/accounts";
import { clientKey, getServices } from "@/lib/server/services";
import { createSupabaseWaitlistStore, handleWaitlistJoin } from "@/lib/server/waitlist";

/** Anyone can join the waitlist, signed in or not. */
export async function POST(request: Request) {
  const { allowed, retryAfterSec } = await getServices().waitlistLimit.check(clientKey(request));
  if (!allowed) {
    return Response.json(
      { success: false, error: "Too many tries. Please try again in an hour." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  let db;
  try {
    db = getAdminDb();
  } catch (error) {
    console.error("[waitlist] database not configured", error);
    return Response.json(NOT_SET_UP, { status: 503 });
  }

  try {
    const { status, body } = await handleWaitlistJoin(await request.json().catch(() => null), createSupabaseWaitlistStore(db));
    return Response.json(body, { status });
  } catch (error) {
    console.error("[waitlist] save failed", error);
    return Response.json({ success: false, error: "Couldn't add you. Please try again." }, { status: 502 });
  }
}
