import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * The credits ledger. The real one lives in Supabase (supabase/migrations/0001_credits.sql);
 * the memory one is for tests. Every write is idempotent, so retries never double-count.
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

export function createSupabaseCreditStore(db: SupabaseClient): CreditStore {
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const { data, error } = await db.rpc(fn, args);
    if (error) throw new Error(`[credits] ${fn} failed: ${error.message}`);
    return data as T;
  };

  return {
    balance: (userId) => call<number>("credit_balance", { p_user: userId }),
    grantWelcome: (userId, credits) => call<number>("grant_welcome", { p_user: userId, p_credits: credits }),
    spend: async (userId) => {
      const entry = await call<number | string | null>("spend_credit", { p_user: userId });
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
};

/** Same rules as the SQL functions, in memory. `seed` grants starting credits: { userId: credits }. */
export function createMemoryCreditStore(seed: Record<string, number> = {}): CreditStore & { rows: Row[] } {
  const codes = new Map<string, string>();
  const referrals = new Map<string, { inviter: string; rewarded: boolean }>();
  const rows: Row[] = Object.entries(seed).map(([userId, delta], i) => ({ id: i + 1, userId, delta, reason: "grant" }));
  let nextId = rows.length + 1;
  const add = (row: Omit<Row, "id">) => rows.push({ ...row, id: nextId++ });
  const balance = async (userId: string) => rows.filter((r) => r.userId === userId).reduce((sum, r) => sum + r.delta, 0);
  const refund = (render: Row | undefined) => {
    if (!render || rows.some((r) => r.refundOf === render.id)) return;
    add({ userId: render.userId, delta: 1, reason: "refund", refundOf: render.id });
  };

  return {
    rows,
    balance,
    async grantWelcome(userId, credits) {
      if (!rows.some((r) => r.userId === userId && r.reason === "welcome")) add({ userId, delta: credits, reason: "welcome" });
      return balance(userId);
    },
    async spend(userId) {
      if ((await balance(userId)) < 1) return null;
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
