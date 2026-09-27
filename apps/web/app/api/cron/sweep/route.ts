import { createHash, timingSafeEqual } from "node:crypto";
import { getAccounts, getAdminDb } from "@/lib/server/accounts";
import { keepFinishedRender } from "@/lib/server/keep-render";
import { getServices } from "@/lib/server/services";
import { createSupabaseRenderBook, sweepRenders } from "@/lib/server/sweep";

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>". Anyone else is turned away. */
function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(request.headers.get("authorization") ?? ""), digest(`Bearer ${secret}`));
}

/** The daily check-up (vercel.json): refunds renders that failed while nobody was watching. */
export async function GET(request: Request) {
  if (!isCron(request)) return new Response("Not found", { status: 404 });
  try {
    const s = getServices();
    const credits = getAccounts().credits;
    const report = await sweepRenders({
      book: createSupabaseRenderBook(getAdminDb()),
      status: async (id) => {
        const job = await s.higgsfield.status(id);
        return { status: job.status, imageUrl: job.images?.[0] };
      },
      refund: (id) => credits.refundJob(id),
      keep: keepFinishedRender,
    });
    console.info("[sweep] done", report);
    return Response.json({ success: true, data: report }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[sweep] failed", error);
    return Response.json({ success: false, error: "Sweep failed." }, { status: 500 });
  }
}
