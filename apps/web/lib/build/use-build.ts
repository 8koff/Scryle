"use client";

import { useMemo, useSyncExternalStore } from "react";
import { browserBuildStore, BUILD_EVENT, buildKey, type Build } from "./store";

function subscribe(onChange: () => void) {
  window.addEventListener(BUILD_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(BUILD_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/**
 * The build, live: re-renders whenever the store writes it.
 * undefined while rendering on the server, null when it doesn't exist or has expired.
 */
export function useBuild(id: string): Build | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(buildKey(id)),
    () => undefined,
  );
  return useMemo(() => (raw === undefined ? undefined : (browserBuildStore().get(id) ?? null)), [raw, id]);
}
