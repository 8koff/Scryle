import type { SupabaseClient } from "@supabase/supabase-js";
import { accountName, createAccountStore, usesApple, type AppleCredential } from "./account";

type Session = {
  access_token: string;
  user: { id?: string; email?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> };
};

/** Just the parts of the Supabase client the store uses. */
function fakeClient(initial: Session | null = null) {
  let onChange: ((event: string, session: Session | null) => void) | null = null;
  const auth = {
    getSession: jest.fn(async (): Promise<{ data: { session: Session | null } }> => ({ data: { session: initial } })),
    onAuthStateChange: jest.fn((cb: typeof onChange) => {
      onChange = cb;
      return { data: { subscription: { unsubscribe: jest.fn() } } };
    }),
    signInWithOtp: jest.fn(async (): Promise<{ error: { status?: number } | null }> => ({ error: null })),
    verifyOtp: jest.fn(async (): Promise<{ error: { status?: number } | null }> => ({ error: null })),
    signInWithIdToken: jest.fn(async (): Promise<{ error: { status?: number } | null }> => ({ error: null })),
    getUser: jest.fn(async () => ({ data: { user: { user_metadata: {} as Record<string, unknown> } } })),
    updateUser: jest.fn(async () => ({ error: null })),
    signOut: jest.fn(async () => ({ error: null })),
  };
  return { client: { auth } as unknown as SupabaseClient, auth, emit: (s: Session | null) => onChange?.("SIGNED_IN", s) };
}

const okCredits = (credits: number) =>
  jest.fn(async () => new Response(JSON.stringify({ success: true, data: { credits } })));

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeStore(opts: { session?: Session | null; fetcher?: jest.Mock; apple?: () => Promise<AppleCredential> } = {}) {
  const fake = fakeClient(opts.session ?? null);
  const fetcher = opts.fetcher ?? okCredits(1);
  const store = createAccountStore({
    getClient: () => fake.client,
    apiUrl: "https://example.test",
    fetcher: fetcher as unknown as typeof fetch,
    appleSignIn: opts.apple ?? (async () => null),
  });
  store.subscribe(() => {});
  return { store, fetcher, ...fake };
}

describe("accountName", () => {
  test("prefers the typed name over the provider's", () => {
    expect(accountName({ display_name: "Sam", full_name: "Samuel A" })).toBe("Sam");
    expect(accountName({ name: "  " })).toBeNull();
  });
});

describe("usesApple", () => {
  test("is true when Apple is one of the account's sign-in ways", () => {
    expect(usesApple({ provider: "email", providers: ["email", "apple"] })).toBe(true);
    expect(usesApple({ provider: "apple" })).toBe(true);
  });

  test("is false for email-only accounts and missing data", () => {
    expect(usesApple({ provider: "email", providers: ["email"] })).toBe(false);
    expect(usesApple(undefined)).toBe(false);
  });
});

describe("createAccountStore", () => {
  test("is unavailable when sign-in keys are missing", () => {
    const store = createAccountStore({ getClient: () => null, apiUrl: "x", appleSignIn: async () => null });
    store.subscribe(() => {});
    expect(store.getSnapshot()).toEqual({ status: "unavailable" });
  });

  test("knows when the account signs in with Apple", async () => {
    const { store } = makeStore({ session: { access_token: "t", user: { id: "u1", app_metadata: { providers: ["apple"] } } } });
    await flush();

    expect(store.getSnapshot()).toMatchObject({ status: "signed-in", hasApple: true });
  });

  test("signs in from a saved session and loads credits with the Bearer token", async () => {
    const { store, fetcher } = makeStore({ session: { access_token: "tok_123", user: { id: "u1", email: "a@b.co" } } });
    await flush();
    await flush();

    expect(store.getSnapshot()).toEqual({ status: "signed-in", userId: "u1", email: "a@b.co", name: null, credits: 1, hasApple: false });
    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/api/credits");
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer tok_123");
  });

  test("a failed session read goes to signed-out, not a stuck splash screen", async () => {
    const fake = fakeClient();
    fake.auth.getSession.mockRejectedValueOnce(new Error("Keychain locked"));
    const store = createAccountStore({ getClient: () => fake.client, apiUrl: "x", appleSignIn: async () => null });
    store.subscribe(() => {});
    await flush();

    expect(store.getSnapshot()).toEqual({ status: "signed-out" });
  });

  test("a late balance for the last account isn't shown to the next one", async () => {
    let answer: (r: Response) => void = () => {};
    const fetcher = jest.fn(() => new Promise<Response>((r) => (answer = r)));
    const { store, emit } = makeStore({ session: { access_token: "token-a", user: {} }, fetcher });
    await flush();

    emit({ access_token: "token-b", user: {} });
    answer(new Response(JSON.stringify({ success: true, data: { credits: 99 } })));
    await flush();

    expect(store.getSnapshot()).toMatchObject({ status: "signed-in", credits: null });
  });

  test("signOut only signs out this phone", async () => {
    const { store, auth } = makeStore();

    await store.signOut();

    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  test("goes to signed-out when the session ends", async () => {
    const { store, emit } = makeStore({ session: { access_token: "t", user: {} } });
    await flush();

    emit(null);

    expect(store.getSnapshot()).toEqual({ status: "signed-out" });
  });

  test("authFetch sends no Authorization header when signed out", async () => {
    const { store, fetcher } = makeStore();
    await flush();

    await store.authFetch("/api/scan", { method: "POST", headers: { Accept: "application/json" } });

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.test/api/scan");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("Accept")).toBe("application/json");
    expect(headers.has("Authorization")).toBe(false);
  });

  test("sendCode rejects a bad address before calling Supabase", async () => {
    const { store, auth } = makeStore();

    expect(await store.sendCode("not-an-email")).toBe("Type a full email address.");
    expect(auth.signInWithOtp).not.toHaveBeenCalled();
  });

  test("sendCode maps rate limits to a friendly message", async () => {
    const { store, auth } = makeStore();
    auth.signInWithOtp.mockResolvedValueOnce({ error: { status: 429 } });

    expect(await store.sendCode(" a@b.co ")).toMatch(/wait a minute/);
    expect(auth.signInWithOtp).toHaveBeenCalledWith({ email: "a@b.co", options: { shouldCreateUser: true } });
  });

  test("verifyCode keeps only digits and needs at least 6", async () => {
    const { store, auth } = makeStore();

    expect(await store.verifyCode("a@b.co", "12 3")).toBe("Enter the code from the email.");
    expect(await store.verifyCode("a@b.co", "123 456")).toBeNull();
    auth.verifyOtp.mockResolvedValueOnce({ error: { status: 400 } });
    expect(await store.verifyCode("a@b.co", "999999")).toMatch(/wrong or too old/);
    auth.verifyOtp.mockResolvedValueOnce({ error: {} });
    expect(await store.verifyCode("a@b.co", "999999")).toMatch(/Couldn't reach sign-in/);
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: "a@b.co", token: "123456", type: "email" });
  });

  test("Apple sign-in sends the raw nonce and keeps Apple's first-time name", async () => {
    const { store, auth } = makeStore({
      apple: async () => ({ identityToken: "id.jwt", rawNonce: "raw-nonce", name: "Ada Lovelace" }),
    });

    expect(await store.signInWithApple()).toBeNull();
    expect(auth.signInWithIdToken).toHaveBeenCalledWith({ provider: "apple", token: "id.jwt", nonce: "raw-nonce" });
    expect(auth.updateUser).toHaveBeenCalledWith({ data: { display_name: "Ada Lovelace" } });
  });

  test("Apple sign-in doesn't overwrite a name the account already has", async () => {
    const { store, auth } = makeStore({
      apple: async () => ({ identityToken: "id.jwt", rawNonce: "n", name: "Ada" }),
    });
    auth.getUser.mockResolvedValueOnce({ data: { user: { user_metadata: { display_name: "Sam" } } } });

    await store.signInWithApple();

    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  test("closing Apple's sheet is not an error", async () => {
    const { store, auth } = makeStore({ apple: async () => null });

    expect(await store.signInWithApple()).toBeNull();
    expect(auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  test("a failed Apple sheet shows a message", async () => {
    const { store } = makeStore({
      apple: async () => {
        throw new Error("boom");
      },
    });

    expect(await store.signInWithApple()).toMatch(/Couldn't open Sign in with Apple/);
  });
});
