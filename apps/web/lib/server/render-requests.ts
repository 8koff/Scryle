import { createHash } from "node:crypto";
import type { ApiResponse, RenderStart } from "@retrofit/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export type RenderRequestResult = { status: number; body: ApiResponse<RenderStart> };
export type RenderRequestRecord = { fingerprint: string; result: RenderRequestResult | null };
export type RenderRequestStore = {
  /** Only a durable, atomic insert may return null (the caller owns the new operation). */
  claim(owner: string, id: string, fingerprint: string): Promise<RenderRequestRecord | null>;
  get(owner: string, id: string): Promise<RenderRequestRecord | null>;
  complete(owner: string, id: string, result: RenderRequestResult): Promise<void>;
};

export const renderPending = (): RenderRequestResult => ({
  status: 202,
  body: { success: false, code: "render_pending", error: "We're checking this swap. Open My swaps to check again without starting another." },
});

/** Stable object ordering; selection-array order remains part of the intended request. */
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, v]) => [key, canonical(v)]));
  }
  return value;
}

/** A persisted claim is never leased or reclaimed: its provider call may already have been accepted. */
export async function runRenderRequest(
  owner: string,
  id: string,
  input: unknown,
  store: RenderRequestStore,
  run: () => Promise<RenderRequestResult>,
): Promise<RenderRequestResult> {
  const fingerprint = createHash("sha256").update(JSON.stringify(canonical(input))).digest("hex");
  let previous: RenderRequestRecord | null;
  try {
    previous = await store.claim(owner, id, fingerprint);
  } catch {
    return { status: 503, body: { success: false, code: "render_unavailable", error: "Couldn't safely start or recover this swap. Please try again." } };
  }
  if (previous) {
    if (previous.fingerprint !== fingerprint) {
      return { status: 409, body: { success: false, code: "render_conflict", error: "This request belongs to different picks. Check My swaps for the original." } };
    }
    return previous.result ?? renderPending();
  }

  let result: RenderRequestResult;
  try {
    result = await run();
  } catch {
    // Execution may have reached the provider. Never release the claim or blindly start again.
    console.error("[render-request] execution interrupted");
    return renderPending();
  }
  if (!result.body.success && result.body.code === "render_pending") return result;
  if (!result.body.success && !result.body.code) result = { ...result, body: { ...result.body, code: "render_rejected" } };
  try {
    await store.complete(owner, id, result);
  } catch {
    try {
      await store.complete(owner, id, result);
    } catch {
      console.error("[render-request] outcome could not be saved");
      // Returning a known job lets this client keep polling it. The durable claim still blocks duplicates.
    }
  }
  return result;
}

const ResultSchema = z.object({
  status: z.number().int().min(200).max(599),
  body: z.discriminatedUnion("success", [
    z.object({ success: z.literal(true), data: z.object({ jobId: z.string().min(1), jobToken: z.string().min(1), costUsd: z.number().nonnegative(), requestId: z.uuid().optional() }) }),
    z.object({ success: z.literal(false), error: z.string(), code: z.enum(["sign_in", "no_credits", "apple_confirm", "render_pending", "render_conflict", "render_unavailable", "render_rejected"]).optional() }),
  ]),
});
const RowSchema = z.object({ fingerprint: z.string().regex(/^[a-f0-9]{64}$/), result: ResultSchema.nullable() });

/** RLS denies browser access. Every read/write additionally includes the verified account ID. */
export function createSupabaseRenderRequestStore(db: SupabaseClient): RenderRequestStore {
  const get: RenderRequestStore["get"] = async (owner, id) => {
    const { data, error } = await db.from("render_requests").select("fingerprint,result").eq("owner", owner).eq("request_id", id).maybeSingle();
    if (error) throw new Error("Render request lookup failed");
    return data ? RowSchema.parse(data) : null;
  };
  return {
    get,
    async claim(owner, id, fingerprint) {
      const { error } = await db.from("render_requests").insert({ owner, request_id: id, fingerprint });
      if (!error) return null;
      if (error.code !== "23505") throw new Error("Render request claim failed");
      const previous = await get(owner, id);
      if (!previous) throw new Error("Render request claim was not readable");
      return previous;
    },
    async complete(owner, id, result) {
      const { data, error } = await db.from("render_requests")
        .update({ result, finished_at: new Date().toISOString() })
        .eq("owner", owner).eq("request_id", id).is("result", null).select("request_id").maybeSingle();
      if (error) throw new Error("Render request completion failed");
      // An earlier write can have succeeded even if its response was lost.
      if (!data && !(await get(owner, id))?.result) throw new Error("Render request was not completed");
    },
  };
}

/** Test adapter only. Production always uses the database's unique constraint. */
export function createMemoryRenderRequestStore(): RenderRequestStore {
  const rows = new Map<string, RenderRequestRecord>();
  const key = (owner: string, id: string) => JSON.stringify([owner, id]);
  return {
    async claim(owner, id, fingerprint) {
      const found = rows.get(key(owner, id));
      if (found) return found;
      rows.set(key(owner, id), { fingerprint, result: null });
      return null;
    },
    get: async (owner, id) => rows.get(key(owner, id)) ?? null,
    async complete(owner, id, result) {
      const row = rows.get(key(owner, id));
      if (!row) throw new Error("Unknown request");
      if (!row.result) rows.set(key(owner, id), { ...row, result });
    },
  };
}
