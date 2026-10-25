import { getAccounts, getAdminDb, NOT_SET_UP, userFromRequest } from "@/lib/server/accounts";
import { createSupabaseRenderRequestStore } from "@/lib/server/render-requests";
import { handleRender } from "@/lib/server/render";
import { clientKey, getServices } from "@/lib/server/services";

export async function POST(request: Request) {
  const s = getServices();

  const { allowed, retryAfterSec } = await s.renderLimit.check(clientKey(request));
  if (!allowed) {
    return Response.json(
      { success: false, error: "That's a lot of renders for one hour. Please try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    );
  }

  let accounts;
  try {
    accounts = getAccounts();
  } catch (error) {
    console.error("[render] accounts not configured", error);
    return Response.json(NOT_SET_UP, { status: 503 });
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return Response.json({ success: false, error: "That request didn't look right." }, { status: 400 });
  }

  const user = await userFromRequest(request, accounts.verifyUser);
  const { status, body } = await handleRender(input, {
    secret: s.secret,
    model: s.renderModel,
    productImageUrl: (p) => s.assets.productImageUrl(p),
    combine: (urls) => s.assets.combine(urls),
    estimate: async (endpoint, b) => (await s.higgsfield.estimate(endpoint, b)).usd,
    submit: async (endpoint, b) => (await s.higgsfield.submit(endpoint, b)).requestId,
    spend: s.spend,
    userId: user?.id ?? null,
    credits: accounts.credits,
    recordRender: (r) => accounts.renders.record(r),
    findLive: (ids) => s.shop.store.getMany(ids),
    requests: createSupabaseRenderRequestStore(getAdminDb()),
  });
  return Response.json(body, { status });
}
