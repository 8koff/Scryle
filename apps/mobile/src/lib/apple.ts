import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import type { AppleCredential } from "./account";

/**
 * Opens Apple's sign-in sheet. Apple signs a hash of a one-time nonce into the token, and
 * Supabase checks it against the raw nonce, so a token can't be replayed.
 */
export async function appleSignIn(): Promise<AppleCredential> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const result = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
    if (!result.identityToken) throw new Error("Apple sent no identity token.");
    const name = [result.fullName?.givenName, result.fullName?.familyName].filter(Boolean).join(" ").trim();
    return { identityToken: result.identityToken, rawNonce, name: name || null };
  } catch (error) {
    // The person closed the sheet: not an error.
    if (error instanceof Error && "code" in error && error.code === "ERR_REQUEST_CANCELED") return null;
    throw error;
  }
}
