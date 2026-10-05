import { getAccounts } from "./accounts";
import { keepRender, type KeepResult } from "./renders";
import { fetchImage, jpegToKeep } from "./share";
import { jpegThumb } from "./thumbs";

/** Copies a finished render into the buyer's account with the real storage. */
export function keepFinishedRender(jobId: string, resultUrl: string): Promise<KeepResult> {
  return keepRender(jobId, resultUrl, {
    renders: getAccounts().renders,
    fetchImage: (url) => fetchImage(url),
    keep: jpegToKeep,
    thumb: jpegThumb,
  });
}
