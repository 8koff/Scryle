import { randomInt } from "node:crypto";
import type { CreditStore, InviteClaim } from "./credits";

const CODE_CHARS = "abcdefghijkmnpqrstuvwxyz23456789";
export const INVITE_CODE = /^[a-z0-9]{8}$/;

/** 8 characters from 32: about a trillion codes, so they can't be guessed. */
export function newInviteCode(): string {
  return Array.from({ length: 8 }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join("");
}

/** The user's code, made on first use. A clash with someone else's code just tries a new one. */
export async function inviteCodeFor(userId: string, credits: CreditStore, fresh: () => string = newInviteCode): Promise<string> {
  try {
    return await credits.inviteCode(userId, fresh());
  } catch {
    return credits.inviteCode(userId, fresh());
  }
}

/** Checks the code's shape before asking the database. */
export async function claimInviteCode(userId: string, code: unknown, credits: CreditStore): Promise<InviteClaim> {
  if (typeof code !== "string" || !INVITE_CODE.test(code)) return "unknown";
  return credits.claimInvite(userId, code);
}
