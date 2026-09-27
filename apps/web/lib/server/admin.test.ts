import { describe, expect, it, vi } from "vitest";
import { isConfirmedAdmin, type AccountLookup } from "./admin";

const env = { ADMIN_EMAILS: "Boss@Example.com, other@example.com" };
const boss = { id: "u1", email: "boss@example.com" };
const confirmed: AccountLookup = async () => ({ email: "boss@example.com", confirmedAt: "2026-09-26T00:00:00Z" });

describe("isConfirmedAdmin", () => {
  it("lets in a listed email that the account has confirmed", async () => {
    expect(await isConfirmedAdmin(boss, confirmed, env)).toBe(true);
  });

  it("refuses a listed email that was never confirmed", async () => {
    const unconfirmed: AccountLookup = async () => ({ email: "boss@example.com", confirmedAt: null });
    expect(await isConfirmedAdmin(boss, unconfirmed, env)).toBe(false);
  });

  it("refuses when the account's email is no longer the one in the token", async () => {
    const changed: AccountLookup = async () => ({ email: "someone@else.com", confirmedAt: "2026-09-26T00:00:00Z" });
    expect(await isConfirmedAdmin(boss, changed, env)).toBe(false);
  });

  it("refuses emails that aren't on the list, without looking them up", async () => {
    const lookup = vi.fn(confirmed);
    expect(await isConfirmedAdmin({ id: "u2", email: "stranger@example.com" }, lookup, env)).toBe(false);
    expect(await isConfirmedAdmin(null, lookup, env)).toBe(false);
    expect(lookup).not.toHaveBeenCalled();
  });

  it("refuses a deleted account", async () => {
    expect(await isConfirmedAdmin(boss, async () => null, env)).toBe(false);
  });
});
