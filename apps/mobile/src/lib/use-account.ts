import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { createAccountStore } from "./account";
import { appleSignIn } from "./apple";
import { API_URL } from "./config";
import { supabase } from "./supabase";

/** One account store for the whole app. */
export const account = createAccountStore({ getClient: supabase, apiUrl: API_URL, appleSignIn });

export function useAccount() {
  return useSyncExternalStore(account.subscribe, account.getSnapshot);
}

/**
 * Supabase refreshes the session on a timer. Timers stop in the background on iOS, so the
 * refresh runs only while the app is open (Supabase's advice for React Native).
 */
export function useSessionRefresh() {
  useEffect(() => {
    const client = supabase();
    if (!client) return;
    if (AppState.currentState === "active") void client.auth.startAutoRefresh();
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") void client.auth.startAutoRefresh();
      else void client.auth.stopAutoRefresh();
    });
    return () => sub.remove();
  }, []);
}
