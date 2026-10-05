import {
  Environment,
  NotificationTypeV2,
  SignedDataVerifier,
  Type,
  VerificationException,
  VerificationStatus,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload,
} from "@apple/app-store-server-library";
import { creditPackForAppleProduct, INVITE_RENDERS } from "@retrofit/core";
import type { User } from "./accounts";
import { APPLE_ROOT_CERTS_BASE64 } from "./apple-root-certs";
import type { Fulfillment } from "./checkout";
import type { CreditStore } from "./credits";

/**
 * Apple in-app purchases from the iOS app. The app sends Apple's signed transaction; we check
 * Apple's signature, then add the pack to the ledger once, the same ledger and rules as Stripe.
 * Refunds come from App Store Server Notifications.
 */

const isSandbox = (environment: string | undefined) => environment === Environment.SANDBOX;

/**
 * Ledger key for one Apple transaction: "apple:prod:<id>" or "apple:sandbox:<id>". Never
 * collides with Stripe's "cs_…" session ids, and test ids never touch real ones.
 */
export const appleLedgerKey = (environment: string | undefined, transactionId: string) =>
  `apple:${isSandbox(environment) ? "sandbox" : "prod"}:${transactionId}`;

export type AppleVerifier = {
  transaction(signed: string): Promise<JWSTransactionDecodedPayload>;
  notification(signed: string): Promise<ResponseBodyV2DecodedPayload>;
};

/**
 * Sandbox purchases (TestFlight, App Review, sandbox testers) are free, so they only add swaps
 * when allowed: "all" accounts, or just the listed account ids. Never invite rewards.
 */
export type SandboxPolicy = "none" | "all" | ReadonlySet<string>;

type Env = Record<string, string | undefined>;

export function sandboxPolicyFromEnv(env: Env = process.env): SandboxPolicy {
  if (env.APPLE_ALLOW_SANDBOX !== "yes") return "none";
  const ids = (env.APPLE_SANDBOX_USERS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return ids.length ? new Set(ids) : "all";
}

const isSandboxAllowed = (policy: SandboxPolicy, userId: string) =>
  policy === "all" || (policy !== "none" && policy.has(userId.toLowerCase()));

const rootCertificates = (): Buffer[] => APPLE_ROOT_CERTS_BASE64.map((b64) => Buffer.from(b64, "base64"));

/** Production first, then sandbox if the policy lets any sandbox purchase count. */
export function appleVerifierFromEnv(env: Env = process.env): AppleVerifier {
  const bundleId = env.APPLE_BUNDLE_ID?.trim();
  const appAppleId = Number(env.APPLE_APP_ID);
  if (!bundleId || !Number.isInteger(appAppleId) || appAppleId <= 0) throw new Error("APPLE_BUNDLE_ID and APPLE_APP_ID must be set");
  const certs = rootCertificates();
  const production = new SignedDataVerifier(certs, true, Environment.PRODUCTION, bundleId, appAppleId);
  const policy = sandboxPolicyFromEnv(env);
  if (policy !== "none") console.warn("[apple] sandbox purchases are ON:", policy === "all" ? "every account" : `${policy.size} account(s)`);
  const sandbox = policy !== "none" ? new SignedDataVerifier(certs, true, Environment.SANDBOX, bundleId) : null;

  const tryBoth = async <T>(run: (v: SignedDataVerifier) => Promise<T>): Promise<T> => {
    try {
      return await run(production);
    } catch (error) {
      if (sandbox && isWrongEnvironment(error)) return run(sandbox);
      throw error;
    }
  };
  return {
    transaction: (signed) => tryBoth((v) => v.verifyAndDecodeTransaction(signed)),
    notification: (signed) => tryBoth((v) => v.verifyAndDecodeNotification(signed)),
  };
}

let verifier: AppleVerifier | undefined;
export function getAppleVerifier(): AppleVerifier {
  verifier ??= appleVerifierFromEnv();
  return verifier;
}

const isWrongEnvironment = (error: unknown) =>
  error instanceof VerificationException && error.status === VerificationStatus.INVALID_ENVIRONMENT;

/**
 * True when checking failed for a passing reason (Apple's certificate service or the network),
 * so asking again later can work. A bad signature is not retryable.
 */
export const isRetryable = (error: unknown) =>
  !(error instanceof VerificationException) || error.status === VerificationStatus.RETRYABLE_VERIFICATION_FAILURE;

/** "retry": couldn't check right now; the app keeps the purchase and sends it again later. */
export type AppleFulfillment = Fulfillment | { status: "retry"; added: 0 };

/**
 * Adds the credits for one Apple purchase. Safe to run twice: the ledger counts a transaction
 * once. `appAccountToken` is the buyer's account id, set by the app when buying, so a
 * transaction can't be claimed by another account.
 */
export async function fulfillApplePurchase(
  signedTransaction: string,
  user: User,
  { verify, credits, sandbox = "none" }: { verify: AppleVerifier; credits: CreditStore; sandbox?: SandboxPolicy },
): Promise<AppleFulfillment> {
  let tx: JWSTransactionDecodedPayload;
  try {
    tx = await verify.transaction(signedTransaction);
  } catch (error) {
    console.error("[apple] transaction not verified", error instanceof Error ? error.message : error);
    return isRetryable(error) ? { status: "retry", added: 0 } : { status: "invalid", added: 0 };
  }
  const pack = creditPackForAppleProduct(tx.productId ?? "");
  const isTest = isSandbox(tx.environment);
  const matches =
    pack &&
    tx.transactionId &&
    tx.type === Type.CONSUMABLE &&
    tx.appAccountToken?.toLowerCase() === user.id.toLowerCase() &&
    (!isTest || isSandboxAllowed(sandbox, user.id));
  if (!matches) {
    // Paid but not credited: kept in the logs so it can be fixed by hand if it's a real buyer.
    console.error("[apple] transaction doesn't match a pack, this account or the sandbox rule", tx.transactionId, tx.environment);
    return { status: "invalid", added: 0 };
  }
  // Refunded before it reached us: nothing to add, and the app may finish it.
  if (tx.revocationDate) return { status: "already", userId: user.id, added: 0 };

  const isNew = await credits.addPurchase(user.id, pack.credits, appleLedgerKey(tx.environment, tx.transactionId!));
  if (!isNew) return { status: "already", userId: user.id, added: 0 };
  // Test purchases are free, so they never earn invite rewards.
  if (isTest) return { status: "added", userId: user.id, added: pack.credits };
  // Same as Stripe: the purchase is safe either way; a failed invite reward is only logged.
  const rewarded = await credits.rewardInvite(user.id, INVITE_RENDERS).catch((error) => {
    console.error("[apple] invite reward failed", user.id, error);
    return false;
  });
  return { status: "added", userId: user.id, added: pack.credits, ...(rewarded ? { bonus: INVITE_RENDERS } : {}) };
}

/** Notifications that take a purchase back. */
const REVERSALS = new Set<string>([NotificationTypeV2.REFUND, NotificationTypeV2.REVOKE]);

export type AppleNotificationResult =
  | { status: "reversed" | "already" | "ignored"; removed: number }
  | { status: "invalid" }
  /** Couldn't check right now: answer an error so Apple sends it again. */
  | { status: "retry" };

/**
 * App Store Server Notifications v2. A refund (or revoke) takes the pack's credits back, like a
 * Stripe refund. Everything else is acknowledged and ignored.
 */
export async function handleAppleNotification(
  signedPayload: string,
  { verify, credits }: { verify: AppleVerifier; credits: CreditStore },
): Promise<AppleNotificationResult> {
  const check = async <T>(run: () => Promise<T>): Promise<{ ok: T } | AppleNotificationResult> => {
    try {
      return { ok: await run() };
    } catch (error) {
      // Sandbox notifications while sandbox is off: fine, nothing to do, and Apple shouldn't retry.
      if (isWrongEnvironment(error)) return { status: "ignored", removed: 0 };
      console.error("[apple] notification not verified", error instanceof Error ? error.message : error);
      return isRetryable(error) ? { status: "retry" } : { status: "invalid" };
    }
  };

  const notice = await check(() => verify.notification(signedPayload));
  if (!("ok" in notice)) return notice;
  const type = notice.ok.notificationType;
  if (!type || !REVERSALS.has(type)) return { status: "ignored", removed: 0 };

  const signedTx = notice.ok.data?.signedTransactionInfo;
  if (!signedTx) return { status: "invalid" };
  const tx = await check(() => verify.transaction(signedTx));
  if (!("ok" in tx)) return tx;
  if (!tx.ok.transactionId) return { status: "invalid" };
  const removed = await credits.reversePurchase(appleLedgerKey(tx.ok.environment, tx.ok.transactionId));
  return removed > 0 ? { status: "reversed", removed } : { status: "already", removed: 0 };
}
