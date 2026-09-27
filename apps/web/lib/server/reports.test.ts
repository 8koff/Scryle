import { describe, expect, it, vi } from "vitest";
import { createMemoryReportStore, decideReport, handleReport } from "./reports";
import { createMemoryShareStore } from "./shares";

const ID = "abcdefgh23";

async function setup() {
  const shares = createMemoryShareStore();
  await shares.insert({ id: ID, owner: "u1", jobId: "job-1", pack: "room", width: 10, height: 10, selections: [], labels: [] });
  await shares.upload(ID, "before", Buffer.from("b"));
  const reports = createMemoryReportStore();
  return { shares, reports, canHide: async () => true };
}

describe("handleReport", () => {
  it("hides the link at once for a sexual image or a child", async () => {
    for (const reason of ["intimate", "minor"]) {
      const deps = await setup();
      const result = await handleReport({ shareId: ID, reason }, deps);
      expect(result).toEqual({ status: 200, body: { success: true, data: { hidden: true } } });
      expect((await deps.shares.get(ID))?.hidden).toBe(true);
    }
  });

  it("keeps the link up once this visitor has used up today's instant hides", async () => {
    const deps = { ...(await setup()), canHide: vi.fn(async () => false) };
    const result = await handleReport({ shareId: ID, reason: "intimate" }, deps);
    expect(result).toEqual({ status: 200, body: { success: true, data: { hidden: false } } });
    expect((await deps.shares.get(ID))?.hidden).toBe(false);
    expect(deps.reports.rows).toHaveLength(1);
  });

  it("only spends an instant hide on reasons that hide", async () => {
    const deps = { ...(await setup()), canHide: vi.fn(async () => true) };
    await handleReport({ shareId: ID, reason: "copyright" }, deps);
    expect(deps.canHide).not.toHaveBeenCalled();
  });

  it("keeps the link up for other reasons, but saves the report", async () => {
    const deps = await setup();
    const result = await handleReport({ shareId: ID, reason: "copyright", details: " my photo ", contact: "a@b.co" }, deps);
    expect(result.status).toBe(200);
    expect((await deps.shares.get(ID))?.hidden).toBe(false);
    expect(deps.reports.rows[0]).toMatchObject({ shareId: ID, reason: "copyright", details: "my photo", contact: "a@b.co", status: "open" });
  });

  it("rejects a bad reason, a bad email or a bad link id", async () => {
    const deps = await setup();
    expect((await handleReport({ shareId: ID, reason: "boring" }, deps)).status).toBe(400);
    expect((await handleReport({ shareId: ID, reason: "other", contact: "not-an-email" }, deps)).status).toBe(400);
    expect((await handleReport({ shareId: "../etc", reason: "other" }, deps)).status).toBe(400);
    expect((await handleReport({ shareId: "zzzzzzzzzz", reason: "other" }, deps)).status).toBe(404);
    expect(deps.reports.rows).toEqual([]);
  });

  it("hides a hidden link from the gallery", async () => {
    const deps = await setup();
    await deps.shares.setGallery(ID, "approved");
    await handleReport({ shareId: ID, reason: "minor" }, deps);
    expect(await deps.shares.listGallery("approved", 10)).toEqual([]);
  });
});

describe("decideReport", () => {
  it("remove deletes the link and its photos and closes every report about it", async () => {
    const deps = await setup();
    await handleReport({ shareId: ID, reason: "intimate" }, deps);
    await handleReport({ shareId: ID, reason: "me" }, deps);

    expect(await decideReport(1, "remove", deps)).toBe("done");
    expect(await deps.shares.get(ID)).toBeNull();
    expect(deps.shares.photos.size).toBe(0);
    expect(deps.reports.rows.map((r) => r.status)).toEqual(["removed", "removed"]);
  });

  it("dismiss shows the link again", async () => {
    const deps = await setup();
    await handleReport({ shareId: ID, reason: "intimate" }, deps);
    expect(await decideReport(1, "dismiss", deps)).toBe("done");
    expect((await deps.shares.get(ID))?.hidden).toBe(false);
    expect(deps.reports.rows[0]?.status).toBe("dismissed");
  });

  it("answers for unknown or closed reports", async () => {
    const deps = await setup();
    expect(await decideReport(9, "remove", deps)).toBe("not_found");
    await handleReport({ shareId: ID, reason: "other" }, deps);
    await decideReport(1, "dismiss", deps);
    expect(await decideReport(1, "remove", deps)).toBe("closed");
  });
});
