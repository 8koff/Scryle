import { getAdminDb } from "@/lib/server/accounts";
import { requireAdmin } from "@/lib/server/admin";
import { adminStats, toGalleryCard, toReportCards } from "@/lib/server/gallery";

const QUEUE_LIMIT = 100;

/** Admin: open reports, the gallery queue (waiting first), what's live, and a few numbers. */
export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { shares, reports } = auth.accounts;
  try {
    const [openReports, pending, approved, stats] = await Promise.all([
      reports.listOpen(QUEUE_LIMIT),
      shares.listGallery("pending", QUEUE_LIMIT),
      shares.listGallery("approved", QUEUE_LIMIT),
      adminStats(getAdminDb()),
    ]);
    return Response.json(
      {
        success: true,
        data: {
          reports: await toReportCards(openReports, shares),
          pending: pending.map((s) => toGalleryCard(s, shares)),
          approved: approved.map((s) => toGalleryCard(s, shares)),
          stats,
        },
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("[admin] gallery load failed", error);
    return Response.json({ success: false, error: "Couldn't load the admin data." }, { status: 502 });
  }
}
