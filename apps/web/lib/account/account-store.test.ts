import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { accountName, createAccountStore, isOwnPath, takeReturnPath } from "./account-store";

type Session = { access_token: string; user: { email?: string; user_metadata?: Record<string, unknown> } };

function fakeClient(initial: Session | null = null) {
  let onChange: (event: string, s: Session | null) => void = () => {};
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: initial } })),
    onAuthStateChange: vi.fn((cb: typeof onChange) => {
      onChange = cb;
      return { data: { subscription: { unsubscribe() {} } } };
    }),
    signInWithOtp: vi.fn(async () => ({ error: null as null | { status: number } })),
    verifyOtp: vi.fn(async () => ({ error: null as null | { status?: number } })),
    signInWithOAuth: vi.fn(async () => ({ error: null as null | { status?: number } })),
    updateUser: vi.fn(async () => ({ error: null as null | { status?: number } })),
    signOut: vi.fn(async () => onChange("SIGNED_OUT", null)),
  };
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (s: Session | null) => onChange("X", s) };
}

const creditsFetch = (credits: number) =>
  vi.fn(async () => new Response(JSON.stringify({ success: true, data: { credits } })));

const flush = () => new Promise((r) => setTimeout(r, 0));

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  };
}

describe("takeReturnPath", () => {
  it("only returns our own recent paths", () => {
    const storage = memoryStorage();
    storage.setItem("retrofit:return-to", JSON.stringify({ path: "//evil.example", at: Date.now() }));
    expect(takeReturnPath(storage)).toBeNull();
    storage.setItem("retrofit:return-to", JSON.stringify({ path: "/build/x", at: 0 }));
    expect(takeReturnPath(storage)).toBeNull();
    storage.setItem("retrofit:return-to", JSON.stringify({ path: "https://evil.example", at: Date.now() }));
    expect(takeReturnPath(storage)).toBeNull();
  });
});

describe("account store", () => {
  it("is unavailable without Supabase keys", () => {
    const store = createAccountStore(() => null);
    store.subscribe(() => {});
    expect(store.getSnapshot()).toEqual({ status: "unavailable" });
  });

  it("loads a saved session and its credits, sending the token", async () => {
    const { client } = fakeClient({ access_token: "tok-1", user: { email: "a@b.co" } });
    const fetcher = creditsFetch(1);
    const store = createAccountStore(() => client, fetcher);
    store.subscribe(() => {});
    await flush();
    await flush();
    expect(store.getSnapshot()).toEqual({ status: "signed-in", email: "a@b.co", name: null, avatarUrl: null, credits: 1 });
    const [, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-1");
  });

  it("emails a sign-in link back to our site and remembers where to return", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    const storage = memoryStorage();
    expect(await store.sendLink("a@b.co", "/build/abc123", "http://localhost:3000", storage)).toBeNull();
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.co",
      options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/" },
    });
    expect(takeReturnPath(storage)).toBe("/build/abc123");
    expect(takeReturnPath(storage)).toBeNull();
  });

  it("signs this tab in when the link is opened, and loads the free render", async () => {
    const { client, emit } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot().status).toBe("signed-out");
    emit({ access_token: "tok-2", user: { email: "a@b.co" } });
    await flush();
    await flush();
    expect(store.getSnapshot()).toEqual({ status: "signed-in", email: "a@b.co", name: null, avatarUrl: null, credits: 1 });
  });

  it("saves the name typed at sign-up with the new account", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    await store.sendLink("a@b.co", "/app", "http://localhost:3000", memoryStorage(), "  Ada  Lovelace ");
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: "a@b.co",
      options: { shouldCreateUser: true, emailRedirectTo: "http://localhost:3000/", data: { display_name: "Ada Lovelace" } },
    });
  });

  it("explains too many emails", async () => {
    const { client, auth } = fakeClient(null);
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429 } });
    const store = createAccountStore(() => client, creditsFetch(0));
    expect(await store.sendLink("a@b.co", "/", "http://localhost:3000", memoryStorage())).toMatch(/too many/i);
  });

  it("doesn't blame the address when Supabase fails to send", async () => {
    const { client, auth } = fakeClient(null);
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 500 } });
    const store = createAccountStore(() => client, creditsFetch(0));
    expect(await store.sendLink("a@b.co", "/", "http://localhost:3000", memoryStorage())).toMatch(/try again later/i);
  });

  it("signs in with the emailed code, ignoring spaces", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.verifyCode("a@b.co", " 123 456 ")).toBeNull();
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "a@b.co", token: "123456", type: "email" });
  });

  it("refuses a short code without asking Supabase", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.verifyCode("a@b.co", "123")).toMatch(/enter the code/i);
    expect(auth.verifyOtp).not.toHaveBeenCalled();
  });

  it("explains a wrong or old code", async () => {
    const { client, auth } = fakeClient(null);
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 403 } });
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.verifyCode("a@b.co", "000000")).toMatch(/wrong or too old/i);
  });

  it("goes back to signed out on sign-out and stops sending the token", async () => {
    const { client } = fakeClient({ access_token: "tok-1", user: {} });
    const fetcher = creditsFetch(3);
    const store = createAccountStore(() => client, fetcher);
    store.subscribe(() => {});
    await flush();
    await store.signOut();
    expect(store.getSnapshot()).toEqual({ status: "signed-out" });
    await store.authFetch("/api/x");
    const [, init] = fetcher.mock.calls.at(-1) as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("sends Google back to our own page", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.signInWithGoogle("http://localhost:3000/", "/app")).toBeNull();
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "http://localhost:3000/app" } });
  });

  it("keeps the chosen category through the Google trip", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    await store.signInWithGoogle("http://localhost:3000", "/app?pack=room");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: { redirectTo: "http://localhost:3000/app?pack=room" } });
  });

  it("never sends Google back to another site", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    await store.signInWithGoogle("http://localhost:3000", "//evil.example");
    await store.signInWithGoogle("http://localhost:3000", "https://evil.example");
    for (const call of auth.signInWithOAuth.mock.calls as unknown as [{ options: { redirectTo: string } }][]) {
      expect(call[0].options.redirectTo).toBe("http://localhost:3000/app");
    }
  });

  it("explains when Google sign-in can't start", async () => {
    const { client, auth } = fakeClient(null);
    auth.signInWithOAuth.mockResolvedValueOnce({ error: { status: 400 } });
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.signInWithGoogle("http://localhost:3000", "/app")).toMatch(/google/i);
  });

  it("shows the name and photo from the account", async () => {
    const { client } = fakeClient({
      access_token: "tok-1",
      user: { email: "a@b.co", user_metadata: { full_name: "Ada Google", display_name: "Ada", avatar_url: "https://lh3.example/a.jpg" } },
    });
    const store = createAccountStore(() => client, creditsFetch(1));
    store.subscribe(() => {});
    await flush();
    expect(store.getSnapshot()).toMatchObject({ name: "Ada", avatarUrl: "https://lh3.example/a.jpg" });
  });

  it("saves a trimmed name, and refuses an empty or long one", async () => {
    const { client, auth } = fakeClient(null);
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.updateName("  Ada Lovelace ")).toBeNull();
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { display_name: "Ada Lovelace" } });
    expect(await store.updateName("   ")).toMatch(/name/i);
    expect(await store.updateName("x".repeat(51))).toMatch(/50/);
    expect(auth.updateUser).toHaveBeenCalledTimes(1);
  });

  it("explains when the name can't be saved", async () => {
    const { client, auth } = fakeClient(null);
    auth.updateUser.mockResolvedValueOnce({ error: { status: 500 } });
    const store = createAccountStore(() => client, creditsFetch(1));
    expect(await store.updateName("Ada")).toMatch(/try again/i);
  });
});

describe("isOwnPath", () => {
  it("allows our pages only", () => {
    expect(isOwnPath("/app/build/abc")).toBe(true);
    expect(isOwnPath("/")).toBe(true);
    expect(isOwnPath("//evil.example")).toBe(false);
    expect(isOwnPath("https://evil.example")).toBe(false);
    expect(isOwnPath("/app?x=1")).toBe(false);
    expect(isOwnPath("/app?pack=room")).toBe(true);
    expect(isOwnPath("/app?pack=room&x=1")).toBe(false);
    expect(isOwnPath("/app//evil.example")).toBe(false);
  });
});

describe("accountName", () => {
  it("prefers the name the person chose, then Google's", () => {
    expect(accountName({ display_name: "Ada", full_name: "A G" })).toBe("Ada");
    expect(accountName({ full_name: "Ada G" })).toBe("Ada G");
    expect(accountName({ name: "Ada N" })).toBe("Ada N");
    expect(accountName({ display_name: "  " })).toBeNull();
    expect(accountName(undefined)).toBeNull();
  });
});
