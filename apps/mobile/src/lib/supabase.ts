import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { createChunkedStorage } from "./secure-storage";

let client: SupabaseClient | null | undefined;

/**
 * The app's Supabase client (sign-in only; credits go through our API, like the web).
 * Null when the public keys aren't set, so the app can still show that sign-in isn't ready.
 */
export function supabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  client =
    SUPABASE_URL && SUPABASE_KEY
      ? createClient(SUPABASE_URL, SUPABASE_KEY, {
          auth: {
            storage: createChunkedStorage(SecureStore),
            persistSession: true,
            autoRefreshToken: true,
            // No web redirects in the app: sign-in is an emailed code or Apple's native sheet.
            detectSessionInUrl: false,
          },
        })
      : null;
  return client;
}
