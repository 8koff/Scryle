import { describe, expect, it, vi } from "vitest";
import { HiggsfieldError } from "./higgsfield/client";
import { STUCK_AFTER_MS, sweepRenders, type OpenJob, type RenderBook, type SweepDeps } from "./sweep";

const NOW = Date.UTC(2026, 8, 24, 12);
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();

function setup(jobs: OpenJob[], statuses: Record<string, string | Error>) {
  const settled = new Map<string, string>();
  const book: RenderBook = {
    openJobs: vi.fn(async () => jobs),
    settle: vi.fn(async (id: string, status: string) => void settled.set(id, status)),
    cleanup: vi.fn(async () => {}),
  };
  const refund = vi.fn(async () => {});
  const keep = vi.fn(async () => "kept");
  const status = vi.fn(async (id: string) => {
    const value = statuses[id]!;
    if (value instanceof Error) throw value;
    return { status: value, ...(value === "completed" ? { imageUrl: `https://x.cloudfront.net/${id}.png` } : {}) };
  });
  return { book, refund, keep, settled, run: (over: Partial<SweepDeps> = {}) => sweepRenders({ book, refund, status, keep, now: () => NOW, ...over }) };
}

describe("sweepRenders", () => {
  it("refunds renders that failed while nobody was watching", async () => {
    const { run, refund, settled } = setup(
      [
        { jobId: "a", createdAt: minutesAgo(10) },
        { jobId: "b", createdAt: minutesAgo(10) },
        { jobId: "c", createdAt: minutesAgo(10) },
      ],
      { a: "failed", b: "nsfw", c: "canceled" },
    );
    expect(await run()).toMatchObject({ checked: 3, refunded: 3 });
    expect(refund.mock.calls.map((c) => (c as unknown[])[0])).toEqual(["a", "b", "c"]);
    expect(settled.get("a")).toBe("failed");
  });

  it("saves finished renders to the account and settles them without refunding", async () => {
    const { run, refund, keep, settled } = setup([{ jobId: "a", createdAt: minutesAgo(10) }], { a: "completed" });
    expect(await run()).toMatchObject({ settled: 1, refunded: 0 });
    expect(keep).toHaveBeenCalledWith("a", "https://x.cloudfront.net/a.png");
    expect(refund).not.toHaveBeenCalled();
    expect(settled.get("a")).toBe("completed");
  });

  it("tries again next time when saving a finished render fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, settled } = setup([{ jobId: "a", createdAt: minutesAgo(10) }], { a: "completed" });
    expect(await run({ keep: vi.fn(async () => Promise.reject(new Error("storage down"))) })).toMatchObject({ errors: 1 });
    expect(settled.has("a")).toBe(false);
  });

  it("leaves recent renders that are still running for next time", async () => {
    const { run, refund, settled } = setup([{ jobId: "a", createdAt: minutesAgo(30) }], { a: "in_progress" });
    expect(await run()).toMatchObject({ waiting: 1 });
    expect(refund).not.toHaveBeenCalled();
    expect(settled.size).toBe(0);
  });

  it("refunds renders stuck for too long", async () => {
    const old = new Date(NOW - STUCK_AFTER_MS - 60_000).toISOString();
    const { run, refund, settled } = setup([{ jobId: "a", createdAt: old }], { a: "queued" });
    expect(await run()).toMatchObject({ refunded: 1 });
    expect(refund).toHaveBeenCalledWith("a");
    expect(settled.get("a")).toBe("stuck");
  });

  it("refunds a render Higgsfield has no record of", async () => {
    const { run, refund } = setup([{ jobId: "a", createdAt: minutesAgo(10) }], { a: new HiggsfieldError(404, null, "nope") });
    expect(await run()).toMatchObject({ refunded: 1 });
    expect(refund).toHaveBeenCalledWith("a");
  });

  it("skips a render it couldn't check and carries on", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { run, settled } = setup(
      [
        { jobId: "a", createdAt: minutesAgo(10) },
        { jobId: "b", createdAt: minutesAgo(10) },
      ],
      { a: new Error("network"), b: "completed" },
    );
    expect(await run()).toMatchObject({ errors: 1, settled: 1 });
    expect(settled.has("a")).toBe(false);
  });

  it("cleans up old rows at the end", async () => {
    const { run, book } = setup([], {});
    await run();
    expect(book.cleanup).toHaveBeenCalled();
  });
});
