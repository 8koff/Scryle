import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { createAccountStore, takeReturnPath } from "./account-store";

type Session = { access_token: string; user: { email?: string } };

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
    expect(store.getSnapshot()).toEqual({ status: "signed-in", email: "a@b.co", credits: 1 });
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
    expect(store.getSnapshot()).toEqual({ status: "signed-in", email: "a@b.co", credits: 1 });
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
});
