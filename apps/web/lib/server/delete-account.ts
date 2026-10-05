import type { RenderStore } from "./renders";
import type { ShareStore } from "./shares";

export type DeleteAccountDeps = {
  shares: Pick<ShareStore, "listByOwner" | "remove">;
  renders: Pick<RenderStore, "removeFilesOf">;
  /** Deletes the sign-in account. The database rows (credits, renders, links, invites) go with it. */
  deleteUser: (userId: string) => Promise<void>;
  /** Cuts the Sign in with Apple link (iPhone app). Throws when it fails, so nothing is deleted yet. */
  disconnectApple?: () => Promise<void>;
};

/**
 * Closes an account for good. Apple first: if Apple can't be reached, nothing is gone and the
 * person can try again. Then files: the database removes the rows by itself when the account
 * goes, but not the files, and a public share picture must never outlive its account.
 * If a file can't be removed, this throws before the account is touched, so it can be retried.
 */
export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<void> {
  await deps.disconnectApple?.();
  for (const share of await deps.shares.listByOwner(userId)) await deps.shares.remove(share.id, userId);
  await deps.renders.removeFilesOf(userId);
  await deps.deleteUser(userId);
}
