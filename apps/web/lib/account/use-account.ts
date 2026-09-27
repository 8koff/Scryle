"use client";

import { useSyncExternalStore } from "react";
import { createAccountStore, type Account } from "./account-store";
import { supabaseBrowser } from "./supabase-browser";

export const account = createAccountStore(supabaseBrowser, (...args) => fetch(...args));

const SERVER: Account = { status: "loading" };

export function useAccount(): Account {
  return useSyncExternalStore(account.subscribe, account.getSnapshot, () => SERVER);
}
