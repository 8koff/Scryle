import { getAccounts, getAdminDb } from "@/lib/server/accounts";
import { createSupabaseAiConsentStore, hasAiConsent, scanCaller, type ScanCaller } from "@/lib/server/ai-consent";
import { handleScan, SCAN_CAP_SHARE, SCAN_COST_USD } from "@/lib/server/scan";
import { clientKey, getServices } from "@/lib/server/services";
import { signPhoto } from "@/lib/server/signing";
import { analyzeScene } from "@/lib/server/vision/analyze";

export async function POST(request: Request) {
  const s = getServices();

  // Each scan costs a few cents (Claude), so cap it per visitor.
  const { allowed, retryAfterSec } = await s.scanLimit.check(clientKey(request));
  if (!allowed) {
    return Response.json(
      { success: false, error: "You've scanned a lot in the last hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  // A signed-in caller (the iPhone app) must have allowed photos to go to our AI partners.
  let caller: ScanCaller;
  try {
    caller = await scanCaller(request, () => getAccounts().verifyUser);
  } catch (error) {
    console.error("[scan] sign-in check failed", error);
    return Response.json({ success: false, error: "We couldn't check your sign-in. Please try again." }, { status: 503 });
  }
  if (caller.kind === "bad-token") {
    return Response.json({ success: false, error: "Please sign in again.", code: "sign_in" }, { status: 401 });
  }
  const userId = caller.kind === "user" ? caller.id : null;

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ success: false, error: "Send the photo as a form upload." }, { status: 400 });
  }

  const { status, body } = await handleScan(form, {
    upload: (bytes, contentType) => s.higgsfield.uploadBytes(bytes, contentType),
    analyze: (pack, photoUrl) => analyzeScene(s.anthropic, pack, { url: photoUrl }, { model: s.visionModel }),
    sign: (claim) => signPhoto(claim, s.secret),
    reserve: () => s.spend.tryReserve(SCAN_COST_USD, { share: SCAN_CAP_SHARE }),
    release: () => s.spend.release(SCAN_COST_USD),
    hasAiConsent: userId ? () => hasAiConsent(createSupabaseAiConsentStore(getAdminDb()), userId) : undefined,
  });
  return Response.json(body, { status });
}
