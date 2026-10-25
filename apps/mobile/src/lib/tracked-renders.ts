import { useSyncExternalStore } from "react";
import { trackedRenders } from "./render";
import { useAccount } from "./use-account";

export function useTrackedRenders() {
  const me = useAccount();
  const owner = me.status === "signed-in" ? me.userId : null;
  return useSyncExternalStore(trackedRenders.subscribe, () => trackedRenders.snapshot(owner));
}
