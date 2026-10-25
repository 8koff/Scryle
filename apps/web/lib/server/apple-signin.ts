import { createPrivateKey, sign, type KeyObject } from "node:crypto";

/**
 * Sign in with Apple: disconnecting an account from Scryle when it is deleted. Apple requires
 * this for apps that offer Sign in with Apple. The iPhone app asks Apple for a fresh one-time
 * authorization code; we trade it for a token, then revoke that token. Apple then removes
 * Scryle from the person's "Sign in with Apple" list.
 */

const APPLE = "https://appleid.apple.com";
const TIMEOUT_MS = 10_000;
/** Apple accepts a client secret for up to 6 months; we make a fresh one per call. */
const SECRET_LIFETIME_S = 300;

export type AppleSignInConfig = {
  /** The app's bundle id. For a native app it is also the Sign in with Apple client id. */
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: KeyObject;
};

type Env = Record<string, string | undefined>;

/**
 * Reads the Sign in with Apple key from the environment. Null when it isn't set up yet.
 * Throws when it is set but broken, so a typo shows up instead of silently skipping.
 */
export function appleSignInFromEnv(env: Env = process.env): AppleSignInConfig | null {
  const clientId = env.APPLE_BUNDLE_ID?.trim();
  const teamId = env.APPLE_TEAM_ID?.trim();
  const keyId = env.APPLE_SIGNIN_KEY_ID?.trim();
  // Vercel and .env files often keep the .p8 file's line breaks as "\n".
  const pem = env.APPLE_SIGNIN_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (!teamId && !keyId && !pem) return null;
  if (!clientId || !teamId || !keyId || !pem) {
    throw new Error("APPLE_BUNDLE_ID, APPLE_TEAM_ID, APPLE_SIGNIN_KEY_ID and APPLE_SIGNIN_PRIVATE_KEY must all be set");
  }
  const privateKey = createPrivateKey(pem);
  // Apple's keys are P-256. Any other key would sign tokens Apple turns down on every delete.
  if (privateKey.asymmetricKeyType !== "ec" || privateKey.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
    throw new Error("APPLE_SIGNIN_PRIVATE_KEY must be the P-256 key from Apple's .p8 file");
  }
  return { clientId, teamId, keyId, privateKey };
}

const base64url = (data: string | Buffer) => Buffer.from(data).toString("base64url");

/** The ES256-signed JWT Apple wants as the "client_secret". */
export function appleClientSecret(config: AppleSignInConfig, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = base64url(JSON.stringify({ alg: "ES256", kid: config.keyId }));
  const payload = base64url(
    JSON.stringify({ iss: config.teamId, iat: nowSeconds, exp: nowSeconds + SECRET_LIFETIME_S, aud: APPLE, sub: config.clientId }),
  );
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: config.privateKey, dsaEncoding: "ieee-p1363" });
  return `${header}.${payload}.${base64url(signature)}`;
}

/** "bad-code": the code is wrong or expired (they last 5 minutes); the app should ask Apple again. */
export type AppleRevokeResult = "revoked" | "bad-code" | "retry";

type TokenAnswer = { refresh_token?: unknown; access_token?: unknown; error?: unknown };

/** Trades the app's authorization code for a token, then revokes it. Never throws. */
export async function revokeAppleSignIn(
  authorizationCode: string,
  config: AppleSignInConfig,
  fetcher: typeof fetch = fetch,
): Promise<AppleRevokeResult> {
  const post = (path: string, fields: Record<string, string>) =>
    fetcher(`${APPLE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: appleClientSecret(config), ...fields }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  try {
    const exchanged = await post("/auth/token", { grant_type: "authorization_code", code: authorizationCode });
    const answer = (await exchanged.json().catch(() => ({}))) as TokenAnswer;
    if (!exchanged.ok) {
      if (answer.error === "invalid_grant") return "bad-code";
      console.error("[apple-signin] token exchange failed", exchanged.status, answer.error);
      return "retry";
    }
    const [token, hint] =
      typeof answer.refresh_token === "string"
        ? [answer.refresh_token, "refresh_token"]
        : typeof answer.access_token === "string"
          ? [answer.access_token, "access_token"]
          : [null, null];
    if (!token || !hint) {
      console.error("[apple-signin] token exchange returned no token");
      return "retry";
    }
    const revoked = await post("/auth/revoke", { token, token_type_hint: hint });
    if (revoked.ok) return "revoked";
    console.error("[apple-signin] revoke failed", revoked.status);
    return "retry";
  } catch (error) {
    console.error("[apple-signin] couldn't reach Apple", error instanceof Error ? error.message : error);
    return "retry";
  }
}
