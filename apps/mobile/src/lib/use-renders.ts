import { isPackId, type RenderCard } from "@retrofit/core";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getApi, type Loaded } from "./api";

type Listener = () => void;

/**
 * The person's saved swaps, shared by Home, My swaps and the swap viewer, so opening one
 * doesn't load the list again. The server's picture links last an hour, so the list is
 * loaded again once it is older than STALE_MS.
 */
const STALE_MS = 30 * 60 * 1000;

let state: Loaded<RenderCard[]> = { status: "loading" };
let loadedAt = 0;
let inFlight: Promise<void> | null = null;
/** Bumped on sign-out, so a load that was already running can't show the last person's list. */
let generation = 0;
const listeners = new Set<Listener>();

const set = (next: Loaded<RenderCard[]>) => {
  state = next;
  listeners.forEach((l) => l());
};

/** Always asks the server (pull-to-refresh, a swap just finished). */
export function reloadRenders(): Promise<void> {
  const mine = generation;
  inFlight ??= getApi<{ renders: RenderCard[] }>("/api/renders")
    .then((result) => {
      if (mine !== generation) return;
      if (result.status === "ready") {
        loadedAt = Date.now();
        const renders = Array.isArray(result.data?.renders) ? result.data.renders : [];
        // A category added on the server after this app version is skipped instead of crashing the list.
        set({ status: "ready", data: renders.filter((r) => isPackId(r.pack)) });
      } else if (state.status !== "ready") {
        // A failed reload keeps the list already on screen.
        set(result);
      }
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Asks the server only when the list is missing or its picture links are getting old. */
export function reloadIfStale(): Promise<void> {
  if (state.status === "ready" && Date.now() - loadedAt < STALE_MS) return Promise.resolve();
  return reloadRenders();
}

/** On sign-out: the next person must never see this list. */
export function resetRenders() {
  generation++;
  inFlight = null;
  loadedAt = 0;
  set({ status: "loading" });
}

export function findRender(jobId: string): RenderCard | undefined {
  return state.status === "ready" ? state.data.find((r) => r.jobId === jobId) : undefined;
}

const subscribe = (listener: Listener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Pictures are cached by swap, not by their link: the server signs a new link on every load,
 * and the picture behind it never changes.
 */
export const pictureSource = (url: string, jobId: string, side: "before" | "after" | "thumb") => ({ uri: url, cacheKey: `${side}-${jobId}` });

/** The small preview for lists; the full picture for swaps saved before previews existed. */
export const thumbSource = (render: RenderCard) =>
  render.thumbUrl ? pictureSource(render.thumbUrl, render.jobId, "thumb") : pictureSource(render.afterUrl, render.jobId, "after");

/** Loads on first use (or when old). `reload` is for pull-to-refresh. */
export function useRenders() {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    void reloadIfStale();
  }, []);
  const reload = useCallback(() => reloadRenders(), []);
  return { renders: current, reload };
}
