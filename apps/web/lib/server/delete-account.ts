import type { RenderStore } from "./renders";
import type { ShareStore } from "./shares";

export type DeleteAccountDeps = {
  shares: Pick<ShareStore, "listByOwner" | "remove">;
  renders: Pick<RenderStore, "removeFilesOf">;
  /** Deletes the sign-in account. The database rows (credits, renders, links, invites) go with it. */
  deleteUser: (userId: string) => Promise<void>;
};

/**
 * Closes an account for good. Files first: the database removes the rows by itself when the
 * account goes, but not the files, and a public share picture must never outlive its account.
 * If a file can't be removed, this throws before the account is touched, so it can be retried.
 */
export async function deleteAccount(userId: string, deps: DeleteAccountDeps): Promise<void> {
  for (const share of await deps.shares.listByOwner(userId)) await deps.shares.remove(share.id, userId);
  await deps.renders.removeFilesOf(userId);
  await deps.deleteUser(userId);
}
