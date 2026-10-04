import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAdminDb, requireUser } from "@/lib/server/accounts";
import { appleSignInFromEnv, revokeAppleSignIn, type AppleRevokeResult, type AppleSignInConfig } from "@/lib/server/apple-signin";
import { deleteAccount } from "@/lib/server/delete-account";

const Body = z.object({
  confirm: z.literal("delete"),
  /** From the iPhone app when the account uses Sign in with Apple: a fresh one-time code from Apple. */
  appleAuthorizationCode: z.string().min(1).max(4096).optional(),
});

class AppleNotDisconnected extends Error {
  constructor(readonly result: Exclude<AppleRevokeResult, "revoked">) {
    super(`[account] Sign in with Apple not disconnected: ${result}`);
  }
}

/** Asked from the server, not the app: the app's copy of the account can be out of date. */
async function isAppleAccount(db: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await db.auth.admin.getUserById(userId);
  if (error) throw new Error(`[account] user lookup failed: ${error.message}`);
  const providers: unknown = data.user?.app_metadata?.providers;
  return Array.isArray(providers) && providers.includes("apple");
}

const fail = (status: number, error: string, code?: "apple_confirm") =>
  Response.json({ success: false, error, ...(code ? { code } : {}) }, { status });

/** Closes the signed-in account and deletes everything in it. The body must say so, on purpose. */
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return fail(400, "That request didn't look right.");
  const code = body.data.appleAuthorizationCode;

  const db = getAdminDb();
  try {
    const apple: AppleSignInConfig | null = appleSignInFromEnv();
    if (!apple) {
      // Apple requires the disconnect, so this must be set up before App Review.
      if (code) console.error("[account] Sign in with Apple key isn't set up; deleting without disconnecting Apple");
    } else if (!code && (await isAppleAccount(db, auth.user.id))) {
      return fail(400, "Confirm with Apple to delete your account.", "apple_confirm");
    }

    await deleteAccount(auth.user.id, {
      shares: auth.accounts.shares,
      renders: auth.accounts.renders,
      deleteUser: async (id) => {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) throw new Error(`[account] user delete failed: ${error.message}`);
      },
      disconnectApple:
        apple && code
          ? async () => {
              const result = await revokeAppleSignIn(code, apple);
              if (result !== "revoked") throw new AppleNotDisconnected(result);
            }
          : undefined,
    });
    return Response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    if (error instanceof AppleNotDisconnected && error.result === "bad-code") return fail(400, "Apple's check expired. Please try again.");
    console.error("[account] delete failed", auth.user.id, error);
    return fail(502, "Couldn't delete your account. Please try again.");
  }
}
