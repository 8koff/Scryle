import type { RenderCard } from "@retrofit/core";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getApi, type Loaded } from "./api";

type Listener = () => void;

/**
 * The person's saved swaps, shared by Home, My swaps and the swap viewer, so opening one
 * doesn't load the list again. The picture links are short-lived, so it reloads on each visit.
 */
let state: Loaded<RenderCard[]> = { status: "loading" };
let inFlight: Promise<void> | null = null;
const listeners = new Set<Listener>();

const set = (next: Loaded<RenderCard[]>) => {
  state = next;
  listeners.forEach((l) => l());
};

export function reloadRenders(): Promise<void> {
  inFlight ??= getApi<RenderCard[]>("/api/renders")
    .then((result) => {
      // A failed reload keeps the list already on screen.
      if (result.status === "ready" || state.status !== "ready") set(result);
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** On sign-out: the next person must never see this list. */
export function resetRenders() {
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

/** Loads on first use. `reload` is for pull-to-refresh. */
export function useRenders() {
  const current = useSyncExternalStore(subscribe, () => state);
  useEffect(() => {
    void reloadRenders();
  }, []);
  const reload = useCallback(() => reloadRenders(), []);
  return { renders: current, reload };
}
