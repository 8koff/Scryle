import { getAccounts, getAdminDb } from "@/lib/server/accounts";
import { handleWebhook, revenueCatApiFromEnv, sandboxAccountsFromEnv } from "@/lib/server/subscriptions";

/** Bigger than any RevenueCat event; anything larger isn't one. */
const MAX_BODY_BYTES = 64_000;

/** Whether the account still exists. Throws when Supabase can't say, so RevenueCat retries the event. */
async function accountExists(userId: string): Promise<boolean> {
  const { data, error } = await getAdminDb().auth.admin.getUserById(userId);
  if (data.user) return true;
  if (error?.status === 404) return false;
  throw new Error(`[revenuecat] account check failed: ${error?.message ?? "no answer"}`);
}

/**
 * RevenueCat → us (set up in RevenueCat → Integrations → Webhooks, with an Authorization value that
 * matches REVENUECAT_WEBHOOK_AUTH). A 500 makes RevenueCat retry later, which is safe: each event
 * just re-reads the customer from RevenueCat (lib/server/subscriptions.ts).
 */
export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_BYTES) return new Response("Too large", { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }

  try {
    const result = await handleWebhook(
      { authorization: request.headers.get("authorization"), body },
      {
        secret: process.env.REVENUECAT_WEBHOOK_AUTH,
        api: revenueCatApiFromEnv(),
        store: getAccounts().subscriptions,
        sandboxAccounts: sandboxAccountsFromEnv(),
        accountExists,
      },
    );
    return new Response(result.body, { status: result.status });
  } catch (error) {
    console.error("[revenuecat] webhook failed", error);
    return new Response("Retry", { status: 500 });
  }
}
