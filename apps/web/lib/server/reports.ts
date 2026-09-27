import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HIDE_AT_ONCE, REPORT_REASONS, type ReportReason } from "@/lib/reports";
import { SHARE_ID, type ShareStore } from "./shares";

export type ReportStatus = "open" | "removed" | "dismissed";

export type Report = {
  id: number;
  shareId: string;
  reason: ReportReason;
  details: string;
  contact: string;
  status: ReportStatus;
  createdAt: string;
};

export type ReportStore = {
  add(report: Pick<Report, "shareId" | "reason" | "details" | "contact">): Promise<void>;
  get(id: number): Promise<Report | null>;
  /** Open reports, oldest first: the one closest to its deadline comes first. */
  listOpen(limit: number): Promise<Report[]>;
  /** Closes every open report about this link. */
  closeForShare(shareId: string, status: Exclude<ReportStatus, "open">): Promise<void>;
};

type Row = {
  id: number;
  share_id: string;
  reason: ReportReason;
  details: string;
  contact: string;
  status: ReportStatus;
  created_at: string;
};

const fromRow = (r: Row): Report => ({
  id: r.id,
  shareId: r.share_id,
  reason: r.reason,
  details: r.details,
  contact: r.contact,
  status: r.status,
  createdAt: r.created_at,
});

export function createSupabaseReportStore(db: SupabaseClient): ReportStore {
  return {
    async add(r) {
      const { error } = await db.from("reports").insert({ share_id: r.shareId, reason: r.reason, details: r.details, contact: r.contact });
      if (error) throw new Error(`[reports] insert failed: ${error.message}`);
    },
    async get(id) {
      const { data, error } = await db.from("reports").select("*").eq("id", id).maybeSingle<Row>();
      if (error) throw new Error(`[reports] read failed: ${error.message}`);
      return data ? fromRow(data) : null;
    },
    async listOpen(limit) {
      const { data, error } = await db
        .from("reports")
        .select("*")
        .eq("status", "open")
        .order("created_at", { ascending: true })
        .limit(limit)
        .returns<Row[]>();
      if (error) throw new Error(`[reports] list failed: ${error.message}`);
      return (data ?? []).map(fromRow);
    },
    async closeForShare(shareId, status) {
      const { error } = await db
        .from("reports")
        .update({ status, decided_at: new Date().toISOString() })
        .eq("share_id", shareId)
        .eq("status", "open");
      if (error) throw new Error(`[reports] close failed: ${error.message}`);
    },
  };
}

/** Same rules, in memory (tests). */
export function createMemoryReportStore(): ReportStore & { rows: Report[] } {
  const rows: Report[] = [];
  return {
    rows,
    async add(r) {
      rows.push({ ...r, id: rows.length + 1, status: "open", createdAt: new Date(rows.length * 1000).toISOString() });
    },
    get: async (id) => rows.find((r) => r.id === id) ?? null,
    listOpen: async (limit) => rows.filter((r) => r.status === "open").slice(0, limit),
    async closeForShare(shareId, status) {
      for (const [i, r] of rows.entries()) if (r.shareId === shareId && r.status === "open") rows[i] = { ...r, status };
    },
  };
}

const ReportInput = z.object({
  shareId: z.string().regex(SHARE_ID),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000).default(""),
  contact: z.union([z.literal(""), z.email().max(200)]).default(""),
});

type Deps = { shares: ShareStore; reports: ReportStore };
type ReportDeps = Deps & {
  /** False when this visitor has used up today's instant hides; the report then waits for an admin. */
  canHide: () => Promise<boolean>;
};
type Result = { status: number; body: { success: true; data: { hidden: boolean } } | { success: false; error: string } };

/**
 * Saves a report about a share link. Anyone can report, signed in or not. A report of a sexual
 * image or a child hides the link at once, so it is down before anyone has checked it. Each
 * visitor gets a few instant hides a day; after that, their reports wait for an admin.
 */
export async function handleReport(input: unknown, deps: ReportDeps): Promise<Result> {
  const parsed = ReportInput.safeParse(input);
  if (!parsed.success) return { status: 400, body: { success: false, error: "Please pick a reason. If you add an email, check it." } };
  const report = parsed.data;

  const share = await deps.shares.get(report.shareId);
  if (!share) return { status: 404, body: { success: false, error: "That link is already gone." } };

  await deps.reports.add(report);
  const hide = HIDE_AT_ONCE.has(report.reason) && (await deps.canHide());
  if (hide) await deps.shares.setHidden(report.shareId, true);
  return { status: 200, body: { success: true, data: { hidden: hide } } };
}

export type ReportAction = "remove" | "dismiss";

/**
 * An admin decides on a report. "remove" deletes the link and its photos for good; "dismiss"
 * shows the link again. Either way, every open report about that link is closed.
 */
export async function decideReport(id: number, action: ReportAction, deps: Deps): Promise<"done" | "not_found" | "closed"> {
  const report = await deps.reports.get(id);
  if (!report) return "not_found";
  if (report.status !== "open") return "closed";
  if (action === "remove") {
    await deps.shares.takeDown(report.shareId);
    await deps.reports.closeForShare(report.shareId, "removed");
  } else {
    await deps.shares.setHidden(report.shareId, false);
    await deps.reports.closeForShare(report.shareId, "dismissed");
  }
  return "done";
}
