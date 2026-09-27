import { getAccounts, NOT_SET_UP } from "@/lib/server/accounts";
import { handleReport } from "@/lib/server/reports";
import { clientKey, getServices } from "@/lib/server/services";

/** Anyone can report a share link, signed in or not. */
export async function POST(request: Request) {
  const s = getServices();
  const visitor = clientKey(request);
  const { allowed, retryAfterSec } = await s.reportLimit.check(visitor);
  if (!allowed) {
    return Response.json(
      { success: false, error: "That's a lot of reports for one hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  let accounts;
  try {
    accounts = getAccounts();
  } catch (error) {
    console.error("[reports] accounts not configured", error);
    return Response.json(NOT_SET_UP, { status: 503 });
  }

  try {
    const { status, body } = await handleReport(await request.json().catch(() => null), {
      ...accounts,
      canHide: async () => (await s.reportHideLimit.check(visitor)).allowed,
    });
    return Response.json(body, { status });
  } catch (error) {
    console.error("[reports] save failed", error);
    return Response.json({ success: false, error: "Couldn't send the report. Please try again." }, { status: 502 });
  }
}
