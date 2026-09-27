import { getAccounts, NOT_SET_UP, userFromRequest } from "@/lib/server/accounts";
import { clientKey, getServices } from "@/lib/server/services";
import { fetchImage, jpegToKeep } from "@/lib/server/share";
import { renderCardPng } from "@/lib/server/share-render";
import { handleCreateShare } from "@/lib/server/shares";

/** Makes a public /b/<id> link for one finished render. */
export async function POST(request: Request) {
  const s = getServices();
  if (!(await s.shareLinkLimit.check(clientKey(request))).allowed) {
    return Response.json({ success: false, error: "That's a lot of links for one hour." }, { status: 429 });
  }
  let accounts;
  try {
    accounts = getAccounts();
  } catch (error) {
    console.error("[shares] accounts not configured", error);
    return Response.json(NOT_SET_UP, { status: 503 });
  }
  const input = await request.json().catch(() => null);
  const user = await userFromRequest(request, accounts.verifyUser);

  try {
    const { status, body } = await handleCreateShare(input, {
      secret: s.secret,
      status: (id) => s.higgsfield.status(id),
      userId: user?.id ?? null,
      shares: accounts.shares,
      jobOwner: (jobId) => accounts.credits.jobOwner(jobId),
      fetchImage: (url) => fetchImage(url),
      keep: jpegToKeep,
      card: renderCardPng,
      findLive: (ids) => s.shop.store.getMany(ids),
    });
    return Response.json(body, { status });
  } catch (error) {
    console.error("[shares] create failed", error);
    return Response.json({ success: false, error: "Couldn't make the link. The photos may have expired." }, { status: 502 });
  }
}
