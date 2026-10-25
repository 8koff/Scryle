import { generateKeyPairSync, verify } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { appleClientSecret, appleSignInFromEnv, revokeAppleSignIn, type AppleSignInConfig } from "./apple-signin";

const keys = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const config: AppleSignInConfig = { clientId: "io.scryapp.app", teamId: "TEAM123456", keyId: "KEY1234567", privateKey: keys.privateKey };

const decode = (part: string) => JSON.parse(Buffer.from(part, "base64url").toString()) as Record<string, unknown>;

const answer = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

/** A fake Apple: answers /auth/token and /auth/revoke with the given replies. */
function fakeApple(token: () => Promise<Response>, revoke: () => Promise<Response> = () => answer(200, {})) {
  return vi.fn((url: string | URL | Request) => (String(url).endsWith("/auth/token") ? token() : revoke())) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
}

const formOf = (fetcher: ReturnType<typeof vi.fn>, call: number) =>
  new URLSearchParams(String((fetcher.mock.calls[call]![1] as RequestInit).body));

describe("appleSignInFromEnv", () => {
  it("is null while the Sign in with Apple key isn't set up", () => {
    expect(appleSignInFromEnv({ APPLE_BUNDLE_ID: "io.scryapp.app" })).toBeNull();
  });

  it("throws when only part of the key is set, so a typo doesn't skip silently", () => {
    expect(() => appleSignInFromEnv({ APPLE_BUNDLE_ID: "io.scryapp.app", APPLE_TEAM_ID: "T" })).toThrow(/must all be set/);
  });

  it("turns down a key that isn't Apple's P-256 kind", () => {
    const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const env = { APPLE_BUNDLE_ID: "io.scryapp.app", APPLE_TEAM_ID: "T", APPLE_SIGNIN_KEY_ID: "K", APPLE_SIGNIN_PRIVATE_KEY: rsa };
    expect(() => appleSignInFromEnv(env)).toThrow(/P-256/);
  });

  it("reads a key whose line breaks were saved as \\n", () => {
    const env = { APPLE_BUNDLE_ID: "io.scryapp.app", APPLE_TEAM_ID: "T", APPLE_SIGNIN_KEY_ID: "K", APPLE_SIGNIN_PRIVATE_KEY: pem.replace(/\n/g, "\\n") };
    expect(appleSignInFromEnv(env)).toMatchObject({ clientId: "io.scryapp.app", teamId: "T", keyId: "K" });
  });
});

describe("appleClientSecret", () => {
  it("is an ES256 JWT for Apple, signed with the key", () => {
    const [header, payload, signature] = appleClientSecret(config, 1_000).split(".");

    expect(decode(header!)).toEqual({ alg: "ES256", kid: "KEY1234567" });
    expect(decode(payload!)).toEqual({ iss: "TEAM123456", iat: 1_000, exp: 1_300, aud: "https://appleid.apple.com", sub: "io.scryapp.app" });
    const signed = Buffer.from(`${header}.${payload}`);
    expect(verify("sha256", signed, { key: keys.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(signature!, "base64url"))).toBe(true);
  });
});

describe("revokeAppleSignIn", () => {
  it("trades the code for a refresh token, then revokes that token", async () => {
    const fetcher = fakeApple(() => answer(200, { refresh_token: "r-1", access_token: "a-1" }));

    expect(await revokeAppleSignIn("code-1", config, fetcher)).toBe("revoked");

    expect(formOf(fetcher, 0).get("grant_type")).toBe("authorization_code");
    expect(formOf(fetcher, 0).get("code")).toBe("code-1");
    expect(formOf(fetcher, 0).get("client_id")).toBe("io.scryapp.app");
    expect(formOf(fetcher, 1).get("token")).toBe("r-1");
    expect(formOf(fetcher, 1).get("token_type_hint")).toBe("refresh_token");
  });

  it("revokes the access token when Apple sends no refresh token", async () => {
    const fetcher = fakeApple(() => answer(200, { access_token: "a-1" }));

    expect(await revokeAppleSignIn("code-1", config, fetcher)).toBe("revoked");
    expect(formOf(fetcher, 1).get("token_type_hint")).toBe("access_token");
  });

  it("reports a wrong or expired code, so the app can ask Apple again", async () => {
    const fetcher = fakeApple(() => answer(400, { error: "invalid_grant" }));

    expect(await revokeAppleSignIn("old", config, fetcher)).toBe("bad-code");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks to retry when Apple fails or can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await revokeAppleSignIn("c", config, fakeApple(() => answer(503, {})))).toBe("retry");
    expect(await revokeAppleSignIn("c", config, fakeApple(() => answer(200, {})))).toBe("retry");
    expect(await revokeAppleSignIn("c", config, fakeApple(() => answer(200, { refresh_token: "r" }), () => answer(500, {})))).toBe("retry");
    expect(await revokeAppleSignIn("c", config, fakeApple(() => Promise.reject(new Error("offline"))))).toBe("retry");
  });
});
