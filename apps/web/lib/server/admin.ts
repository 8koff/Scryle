import { getAdminDb, requireUser, type User } from "./accounts";

type Env = Record<string, string | undefined>;

/** ADMIN_EMAILS: a comma-separated list of the emails allowed into /admin. */
export function adminEmails(env: Env = process.env): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** The email in the sign-in token is on the list. Not enough alone: see isConfirmedAdmin. */
export function isAdmin(user: User | null, env: Env = process.env): boolean {
  return Boolean(user?.email && adminEmails(env).has(user.email.toLowerCase()));
}

/** The account as Supabase keeps it: its current email, and when that email was confirmed. */
export type AccountLookup = (userId: string) => Promise<{ email?: string; confirmedAt?: string | null } | null>;

/**
 * On the list, and the account really owns that email. Without the second check, someone could
 * sign up with an admin's email (if the project allows sign-ups without confirming) and get in.
 */
export async function isConfirmedAdmin(user: User | null, lookup: AccountLookup, env: Env = process.env): Promise<boolean> {
  if (!user?.email || !isAdmin(user, env)) return false;
  const account = await lookup(user.id);
  return Boolean(account?.confirmedAt && account.email?.toLowerCase() === user.email.toLowerCase());
}

const lookupAccount: AccountLookup = async (userId) => {
  const { data, error } = await getAdminDb().auth.admin.getUserById(userId);
  if (error) throw new Error(`[admin] account lookup failed: ${error.message}`);
  return data.user ? { email: data.user.email, confirmedAt: data.user.email_confirmed_at } : null;
};

const NOT_FOUND = () => Response.json({ success: false, error: "Not found." }, { status: 404 });

/** For admin routes. Anyone else gets a plain 404, so the routes don't advertise themselves. */
export async function requireAdmin(request: Request): ReturnType<typeof requireUser> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  try {
    if (!(await isConfirmedAdmin(auth.user, lookupAccount))) return { ok: false, response: NOT_FOUND() };
  } catch (error) {
    // Fails closed: if we can't check, nobody gets in.
    console.error("[admin] check failed", error);
    return { ok: false, response: NOT_FOUND() };
  }
  return auth;
}
