import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { ApiResponse, RenderRequestStatus, RenderStart, RenderStatus, SelectionInput } from "@retrofit/core";
import { getApi, postJson, withTimeout, type Loaded } from "./api";
import { claimOf, type Build } from "./builds";
import { API_URL } from "./config";
import { reloadRenders } from "./use-renders";
import { account } from "./use-account";
import { createRenderRequests } from "./render-requests";

/** Same timing as the web studio. */
export const POLL_MS = 2500;
/** Give up after about six minutes; Higgsfield refunds renders that never finish. */
export const MAX_POLLS = 150;
/** One status check; the next poll tries again. */
const CHECK_TIMEOUT_MS = 20_000;
const DONE = new Set(["completed", "failed", "nsfw", "canceled"]);

export type RenderEnd =
  | { status: "done"; imageUrl: string }
  | { status: "failed"; message: string }
  /** Still running when we stopped asking. The server keeps it, and My swaps shows it later. */
  | { status: "timeout" };

export async function startRender(build: Build, selections: SelectionInput[], label = "Swap", fresh = false): Promise<Exclude<Loaded<RenderStart>, { status: "loading" }>> {
  return trackedRenders.start({ ...claimOf(build), selections }, label, fresh);
}

/** One status check. Null while it is still running (or the network blinked). */
export async function checkRender(jobId: string, jobToken: string, fetcher: typeof fetch = fetch): Promise<RenderEnd | null> {
  try {
    const url = `${API_URL}/api/render/${encodeURIComponent(jobId)}?t=${encodeURIComponent(jobToken)}`;
    const response = await withTimeout((signal) => fetcher(url, { signal }), CHECK_TIMEOUT_MS);
    // The server doesn't know this job (bad or changed signature): asking again won't help.
    if (response.status === 404) return { status: "failed", message: "This swap can't be found. You weren't charged for a failed swap." };
    const body = (await response.json()) as ApiResponse<RenderStatus>;
    if (!body.success || !DONE.has(body.data.status)) return null;
    const { status, imageUrl } = body.data;
    if (status === "completed" && imageUrl) return { status: "done", imageUrl };
    return {
      status: "failed",
      message: status === "nsfw" ? "That swap was blocked by the safety filter." : "The picture failed. You weren't charged.",
    };
  } catch {
    return null;
  }
}

/**
 * Polls until the render ends, the poll limit is hit, or `signal` is aborted.
 * `wait` is injectable so tests don't sleep.
 */
export async function waitForRender(
  jobId: string,
  jobToken: string,
  signal: AbortSignal,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  fetcher: typeof fetch = fetch,
): Promise<RenderEnd> {
  for (let polls = 0; polls < MAX_POLLS && !signal.aborted; polls++) {
    await wait(POLL_MS);
    if (signal.aborted) break;
    const end = await checkRender(jobId, jobToken, fetcher);
    if (end) return end;
  }
  return { status: "timeout" };
}

/**
 * Renders that started but weren't seen to finish (the app closed). The server saves a render
 * to My swaps when it is asked about it, so the app asks again on its next start.
 */
const PENDING_KEY = "retrofit:pending-renders";
/** Older than this, the daily server job has it; stop asking. */
const PENDING_TTL_MS = 24 * 60 * 60 * 1000;
type Pending = { jobId: string; jobToken: string; at: number };

async function readPending(): Promise<Pending[]> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (p): p is Pending =>
        typeof p?.jobId === "string" && typeof p?.jobToken === "string" && typeof p?.at === "number" && Date.now() - p.at < PENDING_TTL_MS,
    );
  } catch {
    return [];
  }
}

const writePending = (list: Pending[]) => AsyncStorage.setItem(PENDING_KEY, JSON.stringify(list)).catch(() => {});

export async function rememberPending(jobId: string, jobToken: string) {
  const list = await readPending();
  await writePending([...list.filter((p) => p.jobId !== jobId), { jobId, jobToken, at: Date.now() }]);
}

export async function forgetPending(jobId: string) {
  await writePending((await readPending()).filter((p) => p.jobId !== jobId));
}

/** The server saves a finished swap just after it answers, so the list is reloaded a moment later. */
const SAVE_DELAY_MS = 3000;
export const reloadSoon = () => setTimeout(() => void reloadRenders(), SAVE_DELAY_MS);

/**
 * On app start and on coming back to the app: asks once about each unfinished render.
 * Finished ones land in My swaps (and failed ones get their swap back on the server).
 */
export async function resumePendingRenders(fetcher: typeof fetch = fetch) {
  const list = await readPending();
  if (!list.length) return;
  const ends = await Promise.all(list.map((p) => checkRender(p.jobId, p.jobToken, fetcher)));
  const ended = new Set(list.filter((_, i) => ends[i] !== null).map((p) => p.jobId));
  if (!ended.size) return;
  // Read again: a render may have started while we were asking.
  await writePending((await readPending()).filter((p) => !ended.has(p.jobId)));
  reloadSoon();
}

/** Clears this phone's render list on sign-out. */
export const clearPending = () => AsyncStorage.removeItem(PENDING_KEY).catch(() => {});

export const trackedRenders = createRenderRequests({
  storage: AsyncStorage,
  owner: () => { const me = account.getSnapshot(); return me.status === "signed-in" ? me.userId : null; },
  newId: Crypto.randomUUID,
  fingerprint: (input) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, JSON.stringify(input)),
  getStatus: (id) => getApi<RenderRequestStatus>(`/api/render/requests/${encodeURIComponent(id)}`),
  post: (input) => postJson<RenderStart>("/api/render", input),
  checkJob: (start) => checkRender(start.jobId, start.jobToken),
  onSettled: () => { reloadSoon(); void account.refreshCredits(); },
});
