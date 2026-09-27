import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseProjectUrl } from "./supabase-url";

let client: SupabaseClient | null | undefined;

/**
 * The browser's Supabase client (sign-in only; credits go through our API).
 * Null when the public keys aren't set, so the rest of the app still works.
 */
export function supabaseBrowser(): SupabaseClient | null {
  if (client !== undefined) return client;
  // Written out in full so Next.js inlines them into the browser bundle.
  const url = supabaseProjectUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
  return client;
}
