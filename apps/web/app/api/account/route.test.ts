import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryRenderStore } from "@/lib/server/renders";
import { createMemoryShareStore } from "@/lib/server/shares";

type Lookup = { data: { user: { app_metadata: { providers: string[] } } }; error: null };

const mocks = vi.hoisted(() => ({
  deleteUser: vi.fn<(id: string) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null })),
  getUserById: vi.fn<(id: string) => Promise<Lookup>>(async () => ({ data: { user: { app_metadata: { providers: ["email"] } } }, error: null })),
  appleConfig: vi.fn((): object | null => null),
  revoke: vi.fn<(code: string, config: object) => Promise<"revoked" | "bad-code" | "retry">>(async () => "revoked"),
}));

vi.mock("@/lib/server/accounts", () => ({
  requireUser: async () => ({
    ok: true,
    user: { id: "u1" },
    accounts: { shares: createMemoryShareStore(), renders: createMemoryRenderStore() },
  }),
  getAdminDb: () => ({ auth: { admin: { deleteUser: mocks.deleteUser, getUserById: mocks.getUserById } } }),
}));

vi.mock("@/lib/server/apple-signin", () => ({
  appleSignInFromEnv: mocks.appleConfig,
  revokeAppleSignIn: mocks.revoke,
}));

const { DELETE } = await import("./route");

const CONFIG = { clientId: "io.scryapp.app" };
const call = (body: unknown) => DELETE(new Request("https://scryle.test/api/account", { method: "DELETE", body: JSON.stringify(body) }));
const appleAccount = () =>
  mocks.getUserById.mockResolvedValueOnce({ data: { user: { app_metadata: { providers: ["apple"] } } }, error: null });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appleConfig.mockReturnValue(null);
  mocks.revoke.mockResolvedValue("revoked");
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("DELETE /api/account", () => {
  it("needs the body to say delete, and turns down an oversized Apple code", async () => {
    expect((await call({})).status).toBe(400);
    expect((await call({ confirm: "delete", appleAuthorizationCode: "x".repeat(4097) })).status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("deletes an email account without asking Apple", async () => {
    mocks.appleConfig.mockReturnValue(CONFIG);

    const response = await call({ confirm: "delete" });

    expect(response.status).toBe(200);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("asks an Apple account to confirm with Apple when the app sent no code", async () => {
    mocks.appleConfig.mockReturnValue(CONFIG);
    appleAccount();

    const response = await call({ confirm: "delete" });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, code: "apple_confirm" });
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("disconnects Apple with the code, then deletes", async () => {
    mocks.appleConfig.mockReturnValue(CONFIG);

    const response = await call({ confirm: "delete", appleAuthorizationCode: "code-1" });

    expect(response.status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith("code-1", CONFIG);
    expect(mocks.deleteUser).toHaveBeenCalledWith("u1");
  });

  it("keeps the account when Apple's code expired, so the app can try again", async () => {
    mocks.appleConfig.mockReturnValue(CONFIG);
    mocks.revoke.mockResolvedValue("bad-code");

    const response = await call({ confirm: "delete", appleAuthorizationCode: "old" });

    expect(response.status).toBe(400);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("keeps the account when Apple can't be reached", async () => {
    mocks.appleConfig.mockReturnValue(CONFIG);
    mocks.revoke.mockResolvedValue("retry");

    expect((await call({ confirm: "delete", appleAuthorizationCode: "c" })).status).toBe(502);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });

  it("still deletes while the Apple key isn't set up yet, and logs it", async () => {
    const response = await call({ confirm: "delete", appleAuthorizationCode: "c" });

    expect(response.status).toBe(200);
    expect(mocks.revoke).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("isn't set up"));
  });

  it("deletes nothing when the Apple key is only half set up", async () => {
    mocks.appleConfig.mockImplementation(() => {
      throw new Error("must all be set");
    });

    expect((await call({ confirm: "delete", appleAuthorizationCode: "c" })).status).toBe(502);
    expect(mocks.deleteUser).not.toHaveBeenCalled();
  });
});
