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
  });
  return Response.json(body, { status });
}
