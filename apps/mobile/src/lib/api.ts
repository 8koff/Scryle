import type { ApiErrorCode, ApiResponse } from "@retrofit/core";
import { account } from "./use-account";

export type Loaded<T> =
  | { status: "loading" }
  | { status: "error"; message: string; code?: ApiErrorCode }
  | { status: "ready"; data: T };

export const OFFLINE = "Couldn't reach Scryle. Check your connection and try again.";
/** A hung connection must not leave a screen spinning forever. Scans can take a while. */
export const REQUEST_TIMEOUT_MS = 60_000;

/** fetch with a time limit; `init.signal` is replaced. */
export async function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms = REQUEST_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Calls our API as the signed-in person and unwraps the { success, data } envelope.
 * Never throws: every failure comes back as a message the screen can show.
 */
export async function getApi<T>(path: string, init?: RequestInit): Promise<Exclude<Loaded<T>, { status: "loading" }>> {
  try {
    const body = await withTimeout(async (signal) => {
      const response = await account.authFetch(path, { ...init, signal });
      return (await response.json()) as ApiResponse<T>;
    });
    if (body.success) return { status: "ready", data: body.data };
    return { status: "error", message: body.error || "Something went wrong. Please try again.", code: body.code };
  } catch {
    return { status: "error", message: OFFLINE };
  }
}

/** POSTs JSON to our API. */
export const postJson = <T>(path: string, body: unknown) =>
  getApi<T>(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
