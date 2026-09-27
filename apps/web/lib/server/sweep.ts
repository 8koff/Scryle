import type { SupabaseClient } from "@supabase/supabase-js";
import { HiggsfieldError } from "./higgsfield/client";

/** Higgsfield doesn't charge for these, so neither do we. */
const NOT_CHARGED = new Set(["failed", "nsfw", "canceled"]);
/** A render still waiting after this long is treated as lost and refunded. */
export const STUCK_AFTER_MS = 2 * 60 * 60 * 1000;
const MAX_JOBS = 200;
const AT_ONCE = 5;

export type OpenJob = { jobId: string; createdAt: string };

export type RenderBook = {
  /** Paid renders from the last few days that are neither refunded nor settled. */
  openJobs(max: number): Promise<OpenJob[]>;
  /** Marks a render as done, so it isn't checked again. */
  settle(jobId: string, status: string): Promise<void>;
  cleanup(): Promise<void>;
};

export type SweepDeps = {
  book: RenderBook;
  status: (jobId: string) => Promise<{ status: string; imageUrl?: string }>;
  refund: (jobId: string) => Promise<void>;
  /** Copies a finished render into the buyer's account. Safe to repeat. */
  keep: (jobId: string, imageUrl: string) => Promise<unknown>;
  now?: () => number;
};

export type SweepReport = { checked: number; refunded: number; settled: number; waiting: number; errors: number };

type Outcome = "refunded" | "settled" | "waiting" | "error";

async function checkOne(job: OpenJob, deps: SweepDeps, now: number): Promise<Outcome> {
  let status: string;
  let imageUrl: string | undefined;
  try {
    ({ status, imageUrl } = await deps.status(job.jobId));
  } catch (error) {
    // Higgsfield has no such job, so it never ran and was never charged.
    if (error instanceof HiggsfieldError && error.status === 404) status = "missing";
    else {
      console.error("[sweep] status failed", job.jobId, error);
      return "error";
    }
  }

  const stuck = !["completed", "missing", ...NOT_CHARGED].includes(status) && now - Date.parse(job.createdAt) > STUCK_AFTER_MS;
  if (NOT_CHARGED.has(status) || status === "missing" || stuck) {
    await deps.refund(job.jobId);
    await deps.book.settle(job.jobId, stuck ? "stuck" : status);
    return "refunded";
  }
  if (status === "completed") {
    // Settled only once it is safely kept; a failed copy is tried again next time.
    if (imageUrl) await deps.keep(job.jobId, imageUrl);
    await deps.book.settle(job.jobId, status);
    return "settled";
  }
  return "waiting";
}

/**
 * The daily check-up. The studio refunds a failed render while the buyer watches it; this
 * catches the ones nobody was watching (tab closed, phone locked) and the ones that never finish.
 * Finished renders nobody watched are saved to the buyer's account here too.
 */
export async function sweepRenders(deps: SweepDeps): Promise<SweepReport> {
  const now = (deps.now ?? Date.now)();
  const jobs = await deps.book.openJobs(MAX_JOBS);
  const report: SweepReport = { checked: jobs.length, refunded: 0, settled: 0, waiting: 0, errors: 0 };

  for (let i = 0; i < jobs.length; i += AT_ONCE) {
    const outcomes = await Promise.all(
      jobs.slice(i, i + AT_ONCE).map((job) =>
        checkOne(job, deps, now).catch((error: unknown): Outcome => {
          console.error("[sweep] check failed", job.jobId, error);
          return "error";
        }),
      ),
    );
    for (const outcome of outcomes) {
      if (outcome === "refunded") report.refunded++;
      else if (outcome === "settled") report.settled++;
      else if (outcome === "waiting") report.waiting++;
      else report.errors++;
    }
  }

  await deps.book.cleanup();
  return report;
}

export function createSupabaseRenderBook(db: SupabaseClient): RenderBook {
  const call = async <T>(fn: string, args: Record<string, unknown> = {}): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`[sweep] ${fn} failed: ${error.message}`);
    return data as T;
  };
  return {
    async openJobs(max) {
      const rows = await call<{ job_id: string; created_at: string }[] | null>("open_render_jobs", { p_max: max });
      return (rows ?? []).map((r) => ({ jobId: r.job_id, createdAt: r.created_at }));
    },
    settle: (jobId, status) => call<void>("settle_render", { p_job: jobId, p_status: status }),
    cleanup: () => call<void>("cleanup_old_rows"),
  };
}
