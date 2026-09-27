import type Stripe from "stripe";
import { describe, expect, it, vi } from "vitest";
import { fulfillCheckout } from "./checkout";
import { createMemoryCreditStore } from "./credits";
import { claimInviteCode, INVITE_CODE, inviteCodeFor, newInviteCode } from "./invites";

const paidSession = (userId: string, id: string) =>
  ({
    id,
    payment_status: "paid",
    amount_total: 499,
    currency: "usd",
    client_reference_id: userId,
    metadata: { user_id: userId, pack: "starter" },
  }) as unknown as Stripe.Checkout.Session;

describe("invite codes", () => {
  it("makes 8-character codes", () => {
    expect(newInviteCode()).toMatch(INVITE_CODE);
    expect(newInviteCode()).not.toBe(newInviteCode());
  });

  it("gives each person one code that never changes", async () => {
    const credits = createMemoryCreditStore();
    const first = await inviteCodeFor("u1", credits, () => "aaaaaaaa");
    const again = await inviteCodeFor("u1", credits, () => "bbbbbbbb");
    expect(first).toBe("aaaaaaaa");
    expect(again).toBe("aaaaaaaa");
  });

  it("tries a new code once if the first one clashes", async () => {
    const credits = createMemoryCreditStore();
    credits.inviteCode = vi.fn().mockRejectedValueOnce(new Error("duplicate")).mockResolvedValueOnce("cccccccc");
    expect(await inviteCodeFor("u1", credits)).toBe("cccccccc");
  });
});

describe("claiming an invite", () => {
  it("links a new account to its inviter", async () => {
    const credits = createMemoryCreditStore();
    await credits.inviteCode("inviter", "aaaaaaaa");
    expect(await claimInviteCode("friend", "aaaaaaaa", credits)).toBe("ok");
    expect(await claimInviteCode("friend", "aaaaaaaa", credits)).toBe("already");
  });

  it("refuses your own code, unknown codes and badly shaped input", async () => {
    const credits = createMemoryCreditStore();
    await credits.inviteCode("inviter", "aaaaaaaa");
    expect(await claimInviteCode("inviter", "aaaaaaaa", credits)).toBe("own");
    expect(await claimInviteCode("friend", "zzzzzzzz", credits)).toBe("unknown");
    expect(await claimInviteCode("friend", "AAAA'; drop", credits)).toBe("unknown");
    expect(await claimInviteCode("friend", 42, credits)).toBe("unknown");
  });

  it("only counts accounts that haven't rendered or bought yet", async () => {
    const credits = createMemoryCreditStore({ friend: 1 });
    await credits.inviteCode("inviter", "aaaaaaaa");
    await credits.spend("friend");
    expect(await claimInviteCode("friend", "aaaaaaaa", credits)).toBe("not_new");
  });
});

describe("invite reward", () => {
  it("pays both people 2 renders on the friend's first purchase, once", async () => {
    const credits = createMemoryCreditStore();
    await credits.inviteCode("inviter", "aaaaaaaa");
    await claimInviteCode("friend", "aaaaaaaa", credits);

    expect(await fulfillCheckout(paidSession("friend", "cs_test_1"), credits)).toMatchObject({ status: "added", added: 25, bonus: 2 });
    expect(await fulfillCheckout(paidSession("friend", "cs_test_2"), credits)).toMatchObject({ status: "added", added: 25 });
    expect((await fulfillCheckout(paidSession("friend", "cs_test_3"), credits)).bonus).toBeUndefined();

    expect(await credits.balance("friend")).toBe(25 * 3 + 2);
    expect(await credits.balance("inviter")).toBe(2);
  });

  it("pays nothing for someone who wasn't invited", async () => {
    const credits = createMemoryCreditStore();
    expect((await fulfillCheckout(paidSession("solo", "cs_test_1"), credits)).bonus).toBeUndefined();
    expect(await credits.balance("solo")).toBe(25);
  });

  it("still adds the bought renders when the reward can't be paid", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const credits = createMemoryCreditStore();
    credits.rewardInvite = vi.fn(async () => Promise.reject(new Error("db down")));
    expect(await fulfillCheckout(paidSession("friend", "cs_test_1"), credits)).toMatchObject({ status: "added", added: 25 });
    expect(await credits.balance("friend")).toBe(25);
  });
});
