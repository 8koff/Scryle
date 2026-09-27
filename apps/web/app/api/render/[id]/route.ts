import { after } from "next/server";
import type { ApiResponse, RenderStatus } from "@/lib/api";
import { getAccounts } from "@/lib/server/accounts";
import { keepFinishedRender } from "@/lib/server/keep-render";
import { getServices } from "@/lib/server/services";
import { verifyJob } from "@/lib/server/signing";

const JOB_ID = /^[a-zA-Z0-9-]{8,80}$/;
/** Higgsfield doesn't charge for these, so neither do we. */
const REFUNDED = new Set(["failed", "nsfw", "canceled"]);

/** Gives the render's credit back. Safe to repeat: the ledger refunds a job only once. */
async function refund(jobId: string) {
  try {
    await getAccounts().credits.refundJob(jobId);
  } catch (error) {
    console.error("[render] refund failed", jobId, error);
  }
}

/** Poll a render. The job token proves this visitor started it. */
export async function GET(request: Request, { params }: RouteContext<"/api/render/[id]">) {
  const { id } = await params;
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const s = getServices();

  if (!JOB_ID.test(id) || !verifyJob(id, token, s.secret)) {
    return Response.json({ success: false, error: "Unknown render." } satisfies ApiResponse<RenderStatus>, { status: 404 });
  }

  try {
    const job = await s.higgsfield.status(id);
    if (REFUNDED.has(job.status)) await refund(id);
    const resultUrl = job.images?.[0];
    if (job.status === "completed" && resultUrl) {
      // Save it to the buyer's account once the answer is sent. The daily sweep retries failures.
      after(() => keepFinishedRender(id, resultUrl).catch((error) => console.error("[render] keep failed", id, error)));
    }
    const body: ApiResponse<RenderStatus> = { success: true, data: { status: job.status, imageUrl: job.images?.[0] } };
    return Response.json(body, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[render] status failed", error);
    return Response.json({ success: false, error: "Couldn't check the render. Retrying…" } satisfies ApiResponse<RenderStatus>, { status: 502 });
  }
}
