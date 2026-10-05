import type { ApiErrorCode, PackId, RenderRequestStatus, RenderStart, ScanResult, SelectionInput } from "@retrofit/core";
import type { Loaded } from "./api";
import type { RenderEnd } from "./render";

export type RenderIntent = {
  claim: Pick<ScanResult, "photoUrl" | "width" | "height" | "scene"> & { pack: PackId };
  token: string;
  selections: SelectionInput[];
};
export type RenderRequest = {
  id: string;
  fingerprint: string;
  label: string;
  state: "checking" | "running" | "ready" | "failed";
  message?: string;
  start?: RenderStart;
};
type Answer<T> = Exclude<Loaded<T>, { status: "loading" }>;
export type RenderRequestDeps = {
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
  owner(): string | null;
  newId(): string;
  fingerprint(input: RenderIntent): Promise<string>;
  getStatus(id: string): Promise<Answer<RenderRequestStatus>>;
  post(input: RenderIntent & { requestId: string }): Promise<Answer<RenderStart>>;
  checkJob(start: RenderStart): Promise<RenderEnd | null>;
  onSettled(): void;
};
const EMPTY: readonly RenderRequest[] = [];
const keyFor = (owner: string) => `retrofit:render-requests:${owner}`;
const error = (message: string, code: ApiErrorCode = "render_pending"): Answer<RenderStart> => ({ status: "error", message, code });
const pending = () => error("Your swap request is saved. Check My swaps or try again to recover it without starting another.");
const isStart = (value: unknown, id: string): value is RenderStart => {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RenderStart>;
  return v.requestId === id && typeof v.jobId === "string" && Boolean(v.jobId) && typeof v.jobToken === "string" && Boolean(v.jobToken)
    && typeof v.costUsd === "number" && Number.isFinite(v.costUsd) && v.costUsd >= 0;
};

/** Account-scoped recovery. No automatic POSTs: background recovery only reads existing requests/jobs. */
export function createRenderRequests(deps: RenderRequestDeps) {
  const snapshots = new Map<string, readonly RenderRequest[]>();
  const listeners = new Set<() => void>();
  const starting = new Map<string, Promise<Answer<RenderStart>>>();
  const recovering = new Map<string, Promise<void>>();
  let writes: Promise<unknown> = Promise.resolve();

  async function read(owner: string): Promise<RenderRequest[]> {
    const raw = await deps.storage.getItem(keyFor(owner));
    const rows: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(rows) || !rows.every((r) => r && typeof r.id === "string" && typeof r.fingerprint === "string"
      && typeof r.label === "string" && ["checking", "running", "ready", "failed"].includes(r.state)
      && (r.message === undefined || typeof r.message === "string") && (r.start === undefined || isStart(r.start, r.id))
      && (!["running", "ready"].includes(r.state) || r.start))) throw new Error("Invalid recovery data");
    return rows as RenderRequest[];
  }

  /** Serializes read/modify/write so simultaneous starts and status updates cannot lose each other. */
  function mutate(owner: string, change: (rows: RenderRequest[]) => RenderRequest[]): Promise<RenderRequest[]> {
    const task = writes.then(async () => {
      const rows = change(await read(owner));
      await deps.storage.setItem(keyFor(owner), JSON.stringify(rows));
      snapshots.set(owner, rows);
      listeners.forEach((l) => l());
      return rows;
    });
    writes = task.catch(() => {});
    return task;
  }
  const update = (owner: string, id: string, patch: Partial<RenderRequest>) =>
    // Foreground recovery and the studio can finish out of order. Terminal states stay terminal.
    mutate(owner, (rows) => rows.map((r) => r.id === id && r.state !== "ready" && r.state !== "failed" ? { ...r, ...patch } : r));

  async function accept(owner: string, row: RenderRequest, result: Answer<RenderStart>): Promise<Answer<RenderStart>> {
    if (deps.owner() !== owner) return error("Please sign in again.", "sign_in");
    if (result.status === "ready" && isStart(result.data, row.id)) {
      await update(owner, row.id, { state: "running", start: result.data, message: undefined });
      return result;
    }
    if (result.status === "error" && ["no_credits", "sign_in", "render_rejected"].includes(result.code ?? "")) {
      await update(owner, row.id, { state: "failed", message: result.message });
      return result;
    }
    await update(owner, row.id, { message: "Waiting to confirm this swap. Checking again will not start another." });
    return pending();
  }

  async function startOne(owner: string, fingerprint: string, input: RenderIntent, label: string, fresh: boolean): Promise<Answer<RenderStart>> {
    let row!: RenderRequest;
    try {
      await mutate(owner, (rows) => {
        const existing = [...rows].reverse().find((r) => r.fingerprint === fingerprint && r.state !== "failed");
        if (existing && (!fresh || existing.state !== "ready")) {
          row = existing;
          return rows;
        }
        // Never discard unresolved requests just to make room; their IDs protect paid work.
        if (rows.filter((r) => r.state === "checking" || r.state === "running").length >= 20) throw new Error("Too many unresolved requests");
        row = { id: deps.newId(), fingerprint, label, state: "checking" };
        const recent = rows.filter((r) => r.state === "checking" || r.state === "running" || rows.indexOf(r) >= rows.length - 50);
        return [...recent, row];
      });
      if (deps.owner() !== owner) return error("Please sign in again.", "sign_in");
      if (row.start) return { status: "ready", data: row.start };

      // This also prevents an older server, which ignores request IDs, from receiving paid starts.
      const checked = await deps.getStatus(row.id);
      if (deps.owner() !== owner) return error("Please sign in again.", "sign_in");
      if (checked.status !== "ready" || checked.data.requestId !== row.id) {
        return error("Couldn't verify swap recovery. Check your connection and try again.", "render_unavailable");
      }
      if (checked.data.state === "pending") return pending();
      if (checked.data.state === "finished") {
        const result = checked.data.result;
        return accept(owner, row, result.success ? { status: "ready", data: result.data } : { status: "error", message: result.error, code: result.code });
      }
      if (checked.data.state !== "missing") return pending();
      return await accept(owner, row, await deps.post({ ...input, requestId: row.id }));
    } catch {
      // No silent empty-store fallback: if persistence is broken, do not create a fresh operation.
      return error("Couldn't safely start or recover this swap. Please try again.", "render_unavailable");
    }
  }

  async function finish(owner: string, row: RenderRequest, end: RenderEnd | null) {
    if (deps.owner() !== owner || !end || end.status === "timeout") return;
    await update(owner, row.id, end.status === "done" ? { state: "ready", message: undefined } : { state: "failed", message: end.message });
    if (deps.owner() === owner) deps.onSettled();
  }

  async function recoverOne(owner: string) {
    let rows: RenderRequest[];
    try { rows = await mutate(owner, (r) => r); } catch { return; }
    for (let row of rows) {
      if (deps.owner() !== owner) return;
      if (row.state === "ready" || row.state === "failed") continue;
      try {
        if (!row.start) {
          const checked = await deps.getStatus(row.id);
          if (deps.owner() !== owner) return;
          if (checked.status !== "ready" || checked.data.requestId !== row.id) continue;
          if (checked.data.state === "missing") {
            await update(owner, row.id, { message: "This request hasn't reached Scryle. Return to your photo to retry it." });
            continue;
          }
          if (checked.data.state !== "finished") continue;
          const result = checked.data.result;
          const accepted = await accept(owner, row, result.success ? { status: "ready", data: result.data } : { status: "error", message: result.error, code: result.code });
          if (accepted.status !== "ready") continue;
          row = { ...row, start: accepted.data, state: "running" };
        }
        if (row.start) await finish(owner, row, await deps.checkJob(row.start));
      } catch {
        // Keep the durable record and try on the next foreground/check action.
      }
    }
  }

  return {
    snapshot: (owner: string | null): readonly RenderRequest[] => owner ? snapshots.get(owner) ?? EMPTY : EMPTY,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    async start(input: RenderIntent, label: string, fresh = false): Promise<Answer<RenderStart>> {
      const owner = deps.owner();
      if (!owner) return error("Please sign in.", "sign_in");
      let fingerprint: string;
      try { fingerprint = await deps.fingerprint(input); } catch { return error("Couldn't save this request.", "render_unavailable"); }
      const key = JSON.stringify([owner, fingerprint]);
      const active = starting.get(key);
      if (active) return active;
      const work = startOne(owner, fingerprint, input, label, fresh).finally(() => starting.delete(key));
      starting.set(key, work);
      return work;
    },
    recover(): Promise<void> {
      const owner = deps.owner();
      if (!owner) return Promise.resolve();
      const active = recovering.get(owner);
      if (active) return active;
      const work = recoverOne(owner).finally(() => recovering.delete(owner));
      recovering.set(owner, work);
      return work;
    },
    async finishJob(jobId: string, end: RenderEnd) {
      const owner = deps.owner();
      if (!owner) return;
      try {
        const row = (await read(owner)).find((r) => r.start?.jobId === jobId);
        if (row) await finish(owner, row, end);
      } catch { /* The durable job is still recoverable on the next status check. */ }
    },
  };
}
