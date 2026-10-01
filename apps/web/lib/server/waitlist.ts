import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export type WaitlistEntry = { email: string; source: string };

export type WaitlistStore = {
  /** Adds the email once. Adding it again changes nothing. */
  add(entry: WaitlistEntry): Promise<void>;
};

export function createSupabaseWaitlistStore(db: SupabaseClient): WaitlistStore {
  return {
    async add(entry) {
      const { error } = await db.from("waitlist").upsert(entry, { onConflict: "email", ignoreDuplicates: true });
      if (error) throw new Error(`[waitlist] insert failed: ${error.message}`);
    },
  };
}

/** For tests. */
export function createMemoryWaitlistStore(): WaitlistStore & { rows: WaitlistEntry[] } {
  const rows: WaitlistEntry[] = [];
  return {
    rows,
    async add(entry) {
      if (!rows.some((r) => r.email === entry.email)) rows.push(entry);
    },
  };
}

const JoinInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  // Where the link was posted (?ref=x). Anything odd is dropped, not refused.
  source: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_-]{1,40}$/)
    .catch(""),
  // A field people never see. Bots fill it in.
  website: z.string().max(200).optional(),
});

type Result = { status: number; body: { success: true } | { success: false; error: string } };

/**
 * Puts an email on the waitlist. The answer is the same whether the email was new or already
 * there, so nobody can use the form to find out who signed up.
 */
export async function handleWaitlistJoin(input: unknown, store: WaitlistStore): Promise<Result> {
  const parsed = JoinInput.safeParse(input);
  if (!parsed.success) return { status: 400, body: { success: false, error: "Please check your email address." } };
  const { email, source, website } = parsed.data;
  // A bot filled in the hidden field: say yes, save nothing.
  if (website) return { status: 200, body: { success: true } };
  await store.add({ email, source });
  return { status: 200, body: { success: true } };
}
