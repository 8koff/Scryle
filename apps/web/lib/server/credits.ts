import type { SupabaseClient } from "@supabase/supabase-js";
import { currentAllowance, type SubscriptionStore } from "./subscriptions";

/**
 * The credits ledger. The real one lives in Supabase (supabase/migrations/0001_credits.sql);
 * the memory one is for tests. Every write is idempotent, so retries never double-count.
 *
 * Since subscriptions (0012_subscriptions.sql), swaps come only from the plan's monthly allowance:
 * `balance` and `spend` ask the subscription store for the plan and pass this month and its
 * allowance to the database. Renders still get a ledger row, so attachJob, refunds and jobOwner
 * work as before.
 */
export type CreditStore = {
  balance(userId: string): Promise<number>;
  /** Gives the free renders once per account; returns the balance. */
  grantWelcome(userId: string, credits: number): Promise<number>;
  /** Takes one credit. Returns a ledger entry id, or null when the balance is 0. */
  spend(userId: string): Promise<number | null>;
  attachJob(entry: number, jobId: string): Promise<void>;
  refundEntry(entry: number): Promise<void>;
  refundJob(jobId: string): Promise<void>;
  /** Who paid for this render (the account that spent the credit), or null. */
  jobOwner(jobId: string): Promise<string | null>;
  /** Adds bought credits. Returns false when this Stripe session was already counted. */
  addPurchase(userId: string, credits: number, sessionId: string): Promise<boolean>;
  /** Takes back what a Stripe session added (refund or dispute). Returns the credits removed, 0 if done before. */
  reversePurchase(sessionId: string): Promise<number>;
  /** The user's invite code: `fresh` is saved the first time, then the same code comes back. */
  inviteCode(userId: string, fresh: string): Promise<string>;
  /** Links a new account to whoever invited it (see InviteClaim). */
  claimInvite(inviteeId: string, code: string): Promise<InviteClaim>;
  /** Pays both people once, after the invitee's first purchase. True the one time it pays. */
  rewardInvite(inviteeId: string, credits: number): Promise<boolean>;
};

export type InviteClaim = "ok" | "unknown" | "own" | "not_new" | "already";
const CLAIMS = new Set<InviteClaim>(["ok", "unknown", "own", "not_new", "already"]);

export function createSupabaseCreditStore(
  db: SupabaseClient,
  subscriptions: SubscriptionStore,
  now: () => Date = () => new Date(),
): CreditStore {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`[credits] ${fn} failed: ${error.message}`);
    return data as T;
  };

  return {
    async balance(userId) {
      const allowance = currentAllowance(await subscriptions.get(userId), now());
      if (!allowance) return 0;
      return call<number>("swap_balance", { p_user: userId, p_month_start: allowance.monthStart.toISOString(), p_granted: allowance.granted });
    },
    grantWelcome: (userId, credits) => call<number>("grant_welcome", { p_user: userId, p_credits: credits }),
    async spend(userId) {
      const allowance = currentAllowance(await subscriptions.get(userId), now());
      if (!allowance) return null;
      const entry = await call<number | string | null>("spend_swap", {
        p_user: userId,
        p_month_start: allowance.monthStart.toISOString(),
        p_granted: allowance.granted,
      });
      return entry === null ? null : Number(entry);
    },
    attachJob: (entry, jobId) => call<void>("attach_job", { p_entry: entry, p_job: jobId }),
    refundEntry: (entry) => call<void>("refund_entry", { p_entry: entry }),
    refundJob: (jobId) => call<void>("refund_job", { p_job: jobId }),
    async jobOwner(jobId) {
      const { data, error } = await db
        .from("credit_ledger")
        .select("user_id")
        .eq("job_id", jobId)
        .eq("reason", "render")
        .maybeSingle<{ user_id: string }>();
      if (error) throw new Error(`[credits] job owner failed: ${error.message}`);
      return data?.user_id ?? null;
    },
    addPurchase: (userId, credits, sessionId) =>
      call<boolean>("add_purchase", { p_user: userId, p_credits: credits, p_session: sessionId }),
    reversePurchase: async (sessionId) => Number(await call<number>("reverse_purchase", { p_session: sessionId })),
    inviteCode: (userId, fresh) => call<string>("invite_code", { p_user: userId, p_new: fresh }),
    async claimInvite(inviteeId, code) {
      const result = await call<string>("claim_invite", { p_invitee: inviteeId, p_code: code });
      if (!CLAIMS.has(result as InviteClaim)) throw new Error(`[credits] claim_invite said ${result}`);
      return result as InviteClaim;
    },
    rewardInvite: async (inviteeId, credits) => (await call<boolean>("reward_invite", { p_invitee: inviteeId, p_credits: credits })) === true,
  };
}

type Row = {
  id: number;
  userId: string;
  delta: number;
  reason: string;
  jobId?: string;
  refundOf?: number;
  reversalOf?: number;
  session?: string;
  /** Allowance mode: the month a render was paid from. */
  month?: string;
};

/**
 * Same rules as the SQL functions, in memory. Two modes:
 * - without `plans`: the old ledger, where `seed` grants starting credits ({ userId: credits });
 * - with `plans`: the monthly allowance of 0012_subscriptions.sql (seed is ignored for spending).
 */
export function createMemoryCreditStore(
  seed: Record<string, number> = {},
  plans?: { subscriptions: SubscriptionStore; now?: () => Date },
): CreditStore & { rows: Row[]; allowance: Map<string, { granted: number; used: number }> } {
  const allowance = new Map<string, { granted: number; used: number }>();
  const monthOf = async (userId: string) => {
    const current = plans && currentAllowance(await plans.subscriptions.get(userId), (plans.now ?? (() => new Date()))());
    return current ? { key: `${userId}|${current.monthStart.toISOString()}`, granted: current.granted } : null;
  };
  const codes = new Map<string, string>();
  const referrals = new Map<string, { inviter: string; rewarded: boolean }>();
  const rows: Row[] = Object.entries(seed).map(([userId, delta], i) => ({ id: i + 1, userId, delta, reason: "grant" }));
  let nextId = rows.length + 1;
  const add = (row: Omit<Row, "id">) => rows.push({ ...row, id: nextId++ });
  const ledgerBalance = async (userId: string) => rows.filter((r) => r.userId === userId).reduce((sum, r) => sum + r.delta, 0);
  const balance = async (userId: string) => {
    if (!plans) return ledgerBalance(userId);
    const month = await monthOf(userId);
    if (!month) return 0;
    const row = allowance.get(month.key);
    return Math.max(0, Math.max(row?.granted ?? 0, month.granted) - (row?.used ?? 0));
  };
  const refund = (render: Row | undefined) => {
    if (!render || rows.some((r) => r.refundOf === render.id)) return;
    add({ userId: render.userId, delta: 1, reason: "refund", refundOf: render.id });
    const row = render.month ? allowance.get(render.month) : undefined;
    if (row) row.used = Math.max(0, row.used - 1);
  };

  return {
    rows,
    allowance,
    balance,
    async grantWelcome(userId, credits) {
      if (!rows.some((r) => r.userId === userId && r.reason === "welcome")) add({ userId, delta: credits, reason: "welcome" });
      return balance(userId);
    },
    async spend(userId) {
      if (plans) {
        const month = await monthOf(userId);
        if (!month) return null;
        const row = allowance.get(month.key) ?? { granted: 0, used: 0 };
        row.granted = Math.max(row.granted, month.granted);
        allowance.set(month.key, row);
        if (row.used >= row.granted) return null;
        row.used++;
        add({ userId, delta: -1, reason: "render", month: month.key });
        return nextId - 1;
      }
      if ((await ledgerBalance(userId)) < 1) return null;
      add({ userId, delta: -1, reason: "render" });
      return nextId - 1;
    },
    async attachJob(entry, jobId) {
      const row = rows.find((r) => r.id === entry && r.reason === "render" && !r.jobId);
      if (row) row.jobId = jobId;
    },
    async refundEntry(entry) {
      refund(rows.find((r) => r.id === entry && r.reason === "render"));
    },
    async refundJob(jobId) {
      refund(rows.find((r) => r.jobId === jobId && r.reason === "render"));
    },
    async jobOwner(jobId) {
      return rows.find((r) => r.jobId === jobId && r.reason === "render")?.userId ?? null;
    },
    async addPurchase(userId, credits, sessionId) {
      if (rows.some((r) => r.session === sessionId)) return false;
      add({ userId, delta: credits, reason: "purchase", session: sessionId });
      return true;
    },
    async reversePurchase(sessionId) {
      const purchase = rows.find((r) => r.session === sessionId && r.reason === "purchase");
      if (!purchase || rows.some((r) => r.reversalOf === purchase.id)) return 0;
      add({ userId: purchase.userId, delta: -purchase.delta, reason: "reversal", reversalOf: purchase.id });
      return purchase.delta;
    },
    async inviteCode(userId, fresh) {
      if (!codes.has(userId)) codes.set(userId, fresh);
      return codes.get(userId)!;
    },
    async claimInvite(inviteeId, code) {
      const inviter = [...codes.entries()].find(([, c]) => c === code)?.[0];
      if (!inviter) return "unknown";
      if (inviter === inviteeId) return "own";
      if (rows.some((r) => r.userId === inviteeId && (r.reason === "purchase" || r.reason === "render"))) return "not_new";
      if (referrals.has(inviteeId)) return "already";
      referrals.set(inviteeId, { inviter, rewarded: false });
      return "ok";
    },
    async rewardInvite(inviteeId, credits) {
      const referral = referrals.get(inviteeId);
      if (!referral || referral.rewarded) return false;
      referrals.set(inviteeId, { ...referral, rewarded: true });
      add({ userId: inviteeId, delta: credits, reason: "invite" });
      add({ userId: referral.inviter, delta: credits, reason: "invite" });
      return true;
    },
  };
}
