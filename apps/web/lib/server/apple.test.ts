import { createHash } from "node:crypto";
import {
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { describe, expect, it, vi } from "vitest";
import {
  appleLedgerKey,
  appleVerifierFromEnv,
  fulfillApplePurchase,
  handleAppleNotification,
  sandboxPolicyFromEnv,
  type AppleVerifier,
} from "./apple";
import { APPLE_ROOT_CERTS_BASE64 } from "./apple-root-certs";
import { createMemoryCreditStore } from "./credits";

const user = { id: "6f1c2a3b-0000-4000-8000-000000000001", email: "a@example.com" };

const tx = (overrides: Partial<JWSTransactionDecodedPayload> = {}): JWSTransactionDecodedPayload => ({
  transactionId: "2000000123",
  originalTransactionId: "2000000123",
  productId: "io.scryapp.credits.starter",
  type: "Consumable",
  appAccountToken: user.id,
  bundleId: "io.scryapp.app",
  environment: "Production",
  ...overrides,
});

/** Stands in for Apple's signature check: "good:<n>" decodes to the nth payload, anything else fails. */
function fakeVerifier(transactions: JWSTransactionDecodedPayload[], notifications: ResponseBodyV2DecodedPayload[] = []): AppleVerifier {
  const pick = <T>(list: T[], signed: string) => {
    const match = /^good:(\d+)$/.exec(signed);
    const item = match ? list[Number(match[1])] : undefined;
    if (!item) return Promise.reject(new VerificationException(VerificationStatus.VERIFICATION_FAILURE));
    return Promise.resolve(item);
  };
  return { transaction: (s) => pick(transactions, s), notification: (s) => pick(notifications, s) };
}

describe("fulfillApplePurchase", () => {
  it("adds the pack once, keyed by Apple's transaction id", async () => {
    const credits = createMemoryCreditStore();
    const verify = fakeVerifier([tx()]);

    const first = await fulfillApplePurchase("good:0", user, { verify, credits });
    const again = await fulfillApplePurchase("good:0", user, { verify, credits });

    expect(first).toMatchObject({ status: "added", added: 25 });
    expect(again).toMatchObject({ status: "already", added: 0 });
    expect(await credits.balance(user.id)).toBe(25);
    expect(credits.rows.find((r) => r.reason === "purchase")?.session).toBe("apple:prod:2000000123");
    expect(appleLedgerKey("Sandbox", "2000000123")).toBe("apple:sandbox:2000000123");
  });

  it("refuses a bad signature", async () => {
    const credits = createMemoryCreditStore();
    vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fulfillApplePurchase("forged", user, { verify: fakeVerifier([]), credits })).toEqual({ status: "invalid", added: 0 });
    expect(await credits.balance(user.id)).toBe(0);
  });

  it("refuses a purchase made by another account, an unknown product, or a non-consumable", async () => {
    const credits = createMemoryCreditStore();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const verify = fakeVerifier([
      tx({ appAccountToken: "6f1c2a3b-0000-4000-8000-00000000ffff" }),
      tx({ appAccountToken: undefined }),
      tx({ productId: "io.scryapp.credits.free-lunch" }),
      tx({ type: "Non-Consumable" }),
    ]);

    for (const signed of ["good:0", "good:1", "good:2", "good:3"]) {
      expect(await fulfillApplePurchase(signed, user, { verify, credits })).toMatchObject({ status: "invalid" });
    }
    expect(await credits.balance(user.id)).toBe(0);
  });

  it("matches the account id in any letter case (Apple may send it upper-case)", async () => {
    const credits = createMemoryCreditStore();
    const verify = fakeVerifier([tx({ appAccountToken: user.id.toUpperCase(), productId: "io.scryapp.credits.pro" })]);

    expect(await fulfillApplePurchase("good:0", user, { verify, credits })).toMatchObject({ status: "added", added: 150 });
  });
});

describe("fulfillApplePurchase edge cases", () => {
  it("a refunded transaction adds nothing but can be finished", async () => {
    const credits = createMemoryCreditStore();

    const result = await fulfillApplePurchase("good:0", user, { verify: fakeVerifier([tx({ revocationDate: 1_700_000_000_000 })]), credits });

    expect(result).toMatchObject({ status: "already", added: 0 });
    expect(await credits.balance(user.id)).toBe(0);
  });

  it("asks the app to try again when Apple's check can't run right now", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const flaky: AppleVerifier = {
      transaction: () => Promise.reject(new VerificationException(VerificationStatus.RETRYABLE_VERIFICATION_FAILURE)),
      notification: () => Promise.reject(new Error("offline")),
    };
    const forged: AppleVerifier = {
      transaction: () => Promise.reject(new VerificationException(VerificationStatus.VERIFICATION_FAILURE)),
      notification: () => Promise.reject(new Error("unused")),
    };
    const credits = createMemoryCreditStore();

    expect(await fulfillApplePurchase("x".repeat(30), user, { verify: flaky, credits })).toEqual({ status: "retry", added: 0 });
    expect(await fulfillApplePurchase("x".repeat(30), user, { verify: forged, credits })).toEqual({ status: "invalid", added: 0 });
  });

  it("test (sandbox) purchases only count when allowed, and never earn invite rewards", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const verify = fakeVerifier([tx({ environment: "Sandbox" })]);
    const off = createMemoryCreditStore();
    const listed = createMemoryCreditStore();
    const reward = vi.fn(async () => true);

    expect(await fulfillApplePurchase("good:0", user, { verify, credits: off })).toMatchObject({ status: "invalid" });
    expect(await fulfillApplePurchase("good:0", user, { verify, credits: { ...listed, rewardInvite: reward }, sandbox: new Set(["someone-else"]) })).toMatchObject({
      status: "invalid",
    });
    expect(
      await fulfillApplePurchase("good:0", user, { verify, credits: { ...listed, rewardInvite: reward }, sandbox: new Set([user.id]) }),
    ).toEqual({ status: "added", userId: user.id, added: 25 });
    expect(reward).not.toHaveBeenCalled();
    expect(listed.rows.find((r) => r.reason === "purchase")?.session).toBe("apple:sandbox:2000000123");
  });
});

describe("sandboxPolicyFromEnv", () => {
  it("is off unless APPLE_ALLOW_SANDBOX=yes, and can be limited to listed accounts", () => {
    expect(sandboxPolicyFromEnv({})).toBe("none");
    expect(sandboxPolicyFromEnv({ APPLE_ALLOW_SANDBOX: "true" })).toBe("none");
    expect(sandboxPolicyFromEnv({ APPLE_ALLOW_SANDBOX: "yes" })).toBe("all");
    expect(sandboxPolicyFromEnv({ APPLE_ALLOW_SANDBOX: "yes", APPLE_SANDBOX_USERS: " A1 , b2 ," })).toEqual(new Set(["a1", "b2"]));
  });
});

describe("handleAppleNotification", () => {
  const notice = (notificationType: string): ResponseBodyV2DecodedPayload => ({
    notificationType,
    data: { signedTransactionInfo: "good:0" },
  });

  it("a refund takes the pack back, once", async () => {
    const credits = createMemoryCreditStore();
    const verify = fakeVerifier([tx()], [notice("REFUND")]);
    await fulfillApplePurchase("good:0", user, { verify, credits });

    expect(await handleAppleNotification("good:0", { verify, credits })).toEqual({ status: "reversed", removed: 25 });
    expect(await handleAppleNotification("good:0", { verify, credits })).toEqual({ status: "already", removed: 0 });
    expect(await credits.balance(user.id)).toBe(0);
  });

  it("other notifications change nothing", async () => {
    const credits = createMemoryCreditStore();
    const verify = fakeVerifier([tx()], [notice("CONSUMPTION_REQUEST")]);
    await fulfillApplePurchase("good:0", user, { verify, credits });

    expect(await handleAppleNotification("good:0", { verify, credits })).toEqual({ status: "ignored", removed: 0 });
    expect(await credits.balance(user.id)).toBe(25);
  });

  it("sandbox notifications while sandbox is off are acknowledged, not retried", async () => {
    const verify: AppleVerifier = {
      transaction: () => Promise.reject(new Error("unused")),
      notification: () => Promise.reject(new VerificationException(VerificationStatus.INVALID_ENVIRONMENT)),
    };
    expect(await handleAppleNotification("x".repeat(30), { verify, credits: createMemoryCreditStore() })).toEqual({ status: "ignored", removed: 0 });
  });

  it("refuses an unsigned notification", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const forged: AppleVerifier = {
      transaction: () => Promise.reject(new Error("unused")),
      notification: () => Promise.reject(new VerificationException(VerificationStatus.VERIFICATION_FAILURE)),
    };
    expect(await handleAppleNotification("forged", { verify: forged, credits: createMemoryCreditStore() })).toEqual({ status: "invalid" });
    // A plain error (network, Apple's certificate service) is worth another try.
    const offline: AppleVerifier = { transaction: () => Promise.reject(new Error("offline")), notification: () => Promise.reject(new Error("offline")) };
    expect(await handleAppleNotification("forged", { verify: offline, credits: createMemoryCreditStore() })).toEqual({ status: "retry" });
  });
});

describe("Apple setup", () => {
  it("ships Apple Root CA - G3 unchanged", () => {
    const der = Buffer.from(APPLE_ROOT_CERTS_BASE64[0]!, "base64");
    expect(createHash("sha256").update(der).digest("hex")).toBe("63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179");
  });

  it("won't start without the bundle id and App Apple ID", () => {
    expect(() => appleVerifierFromEnv({})).toThrow(/APPLE_BUNDLE_ID/);
    expect(() => appleVerifierFromEnv({ APPLE_BUNDLE_ID: "io.scryapp.app", APPLE_APP_ID: "abc" })).toThrow(/APPLE_APP_ID/);
  });
});
