import { AI_CONSENT_VERSION, type AiConsentInfo } from "@retrofit/core";
import { useEffect, useState } from "react";
import { getApi, postJson } from "./api";

export type AiConsent = { status: "checking" } | { status: "needed" } | { status: "allowed" } | { status: "error"; message: string };

/**
 * Accounts the server already said yes for, so the question goes to the server once per app
 * session. Only a yes is kept: "needed" and errors are asked again next time.
 */
const allowedAccounts = new Set<string>();

/** Asks the server whether this account allowed photos to go to our AI partners. */
export async function checkAiConsent(userId: string): Promise<Exclude<AiConsent, { status: "checking" }>> {
  if (allowedAccounts.has(userId)) return { status: "allowed" };
  const result = await getApi<AiConsentInfo>("/api/ai-consent");
  if (result.status === "error") return { status: "error", message: result.message };
  if (result.data.version !== AI_CONSENT_VERSION) {
    return { status: "error", message: "Please update Scryle to review the latest photo permission." };
  }
  if (!result.data.hasConsented) return { status: "needed" };
  allowedAccounts.add(userId);
  return { status: "allowed" };
}

/** The person tapped Allow. Sends the version of the wording this build shows. */
export async function allowAiConsent(userId: string): Promise<Exclude<AiConsent, { status: "checking" }>> {
  const result = await postJson<AiConsentInfo>("/api/ai-consent", { version: AI_CONSENT_VERSION });
  if (result.status === "error") return { status: "error", message: result.message };
  if (result.data.version !== AI_CONSENT_VERSION) {
    return { status: "error", message: "Please update Scryle to review the latest photo permission." };
  }
  if (result.data.hasConsented !== true) {
    return { status: "error", message: "Your permission wasn't saved. Please try again." };
  }
  allowedAccounts.add(userId);
  return { status: "allowed" };
}

/** For tests. */
export function resetAiConsent() {
  allowedAccounts.clear();
}

/** The consent state for the signed-in account, with Allow and Try again. */
export function useAiConsent(userId: string | null) {
  const [state, setState] = useState<AiConsent>({ status: "checking" });
  const [isAllowing, setIsAllowing] = useState(false);

  useEffect(() => {
    if (!userId) return;
    let isLive = true;
    void checkAiConsent(userId).then((next) => {
      if (isLive) setState(next);
    });
    return () => {
      isLive = false;
    };
  }, [userId]);

  const retry = async () => {
    if (!userId) return;
    setState({ status: "checking" });
    setState(await checkAiConsent(userId));
  };

  const allow = async () => {
    if (!userId || isAllowing) return;
    setIsAllowing(true);
    setState(await allowAiConsent(userId));
    setIsAllowing(false);
  };

  return { state, isAllowing, allow, retry };
}
