import { z } from "zod";
import { getAdminDb, requireUser } from "@/lib/server/accounts";
import { deleteAccount } from "@/lib/server/delete-account";

const Body = z.object({ confirm: z.literal("delete") });

/** Closes the signed-in account and deletes everything in it. The body must say so, on purpose. */
export async function DELETE(request: Request) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  if (!Body.safeParse(await request.json().catch(() => null)).success) {
    return Response.json({ success: false, error: "That request didn't look right." }, { status: 400 });
  }

  const db = getAdminDb();
  try {
    await deleteAccount(auth.user.id, {
      shares: auth.accounts.shares,
      renders: auth.accounts.renders,
      deleteUser: async (id) => {
        const { error } = await db.auth.admin.deleteUser(id);
        if (error) throw new Error(`[account] user delete failed: ${error.message}`);
      },
    });
    return Response.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error("[account] delete failed", auth.user.id, error);
    return Response.json({ success: false, error: "Couldn't delete your account. Please try again." }, { status: 502 });
  }
}
