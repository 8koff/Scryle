import { getAdminDb, requireUser } from "@/lib/server/accounts";
import { createSupabaseAiConsentStore, handleAiConsentGet, handleAiConsentPost } from "@/lib/server/ai-consent";
import { clientKey, getServices } from "@/lib/server/services";

type Handler = (userId: string, request: Request) => Promise<{ status: number; body: unknown }>;

/** Rate limit, then sign-in, then the handler. The same steps for asking and for allowing. */
async function run(request: Request, handler: Handler): Promise<Response> {
  const { allowed, retryAfterSec } = await getServices().aiConsentLimit.check(clientKey(request));
  if (!allowed) {
    return Response.json(
      { success: false, error: "Too many tries. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const { status, body } = await handler(auth.user.id, request);
    return Response.json(body, { status });
  } catch (error) {
    console.error("[ai-consent] failed", error);
    return Response.json({ success: false, error: "Couldn't reach your settings. Please try again." }, { status: 502 });
  }
}

/** Has this account allowed photos to go to our AI partners (the current wording)? */
export async function GET(request: Request) {
  return run(request, (userId) => handleAiConsentGet(userId, createSupabaseAiConsentStore(getAdminDb())));
}

/** The person tapped "Allow". Body: { version } of the wording the app showed. */
export async function POST(request: Request) {
  return run(request, async (userId, req) =>
    handleAiConsentPost(await req.json().catch(() => null), userId, createSupabaseAiConsentStore(getAdminDb())),
  );
}
