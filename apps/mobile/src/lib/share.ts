import { BRAND, type SelectionInput } from "@retrofit/core";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Share } from "react-native";
import { postJson, withTimeout } from "./api";
import { claimOf, type Build } from "./builds";
import { API_URL } from "./config";
import { account } from "./use-account";

/** Same words as the web's share button. */
export const SHARE_TEXT = `AI edit made with ${BRAND.name} ${BRAND.shareHashtag}`;

export type ShareJob = { jobId: string; jobToken: string };

/** What the server needs to prove this photo and this swap are yours. */
const proof = (build: Build, job: ShareJob) => ({ ...claimOf(build), jobId: job.jobId, jobToken: job.jobToken });

/**
 * One before/after picture (labelled by the server), sent with the iOS share sheet. Private:
 * only people it's sent to see it. Returns an error message, or null.
 */
export async function sharePicture(build: Build, job: ShareJob): Promise<string | null> {
  try {
    const bytes = await withTimeout(async (signal) => {
      const response = await account.authFetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proof(build, job)),
        signal,
      });
      if (!response.ok) throw new Error("card failed");
      return new Uint8Array(await response.arrayBuffer());
    });
    const file = new File(Paths.cache, `${BRAND.name.toLowerCase()}-before-after.png`);
    file.create({ overwrite: true });
    file.write(bytes);
    await Sharing.shareAsync(file.uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: SHARE_TEXT });
    return null;
  } catch {
    return "Couldn't make the picture. The photo may have expired.";
  }
}

/**
 * A public page with both photos and a "Try this on me" button. Anyone with the link can see
 * it until its owner deletes it. Returns the link, or an error message.
 */
export async function makeShareLink(
  build: Build,
  job: ShareJob,
  selections: SelectionInput[],
): Promise<{ url: string } | { error: string }> {
  const result = await postJson<{ id: string }>("/api/shares", { ...proof(build, job), selections });
  if (result.status === "error") return { error: result.message };
  const url = `${API_URL}/b/${result.data.id}`;
  // The sheet can be closed; nothing to report.
  await Share.share({ url, message: SHARE_TEXT }).catch(() => {});
  return { url };
}
