/**
 * Consent to send photos to our AI partners (Apple guideline 5.1.2(i)): a one-time "Allow" before
 * the first scan, stored on the server, which refuses a signed-in scan without it.
 *
 * The version names the wording the person agreed to. Raise it when that wording changes in a way
 * that matters (a new AI partner, a new use of the photo): everyone is then asked again, and an app
 * that still shows the old wording can't record consent for the new one.
 */
export const AI_CONSENT_VERSION = 1;

/** GET /api/ai-consent. */
export type AiConsentInfo = { hasConsented: boolean; version: number };
