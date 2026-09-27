const KEY = "retrofit:invite";
/** An invite link is remembered for this long before sign-in. */
export const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE = /^[a-z0-9]{8}$/;

type Saved = { code: string; at: number };

/** Remembers a code from an invite link. False (and nothing saved) if it doesn't look right. */
export function saveInvite(storage: Storage, code: string, now: number = Date.now()): boolean {
  const clean = code.trim().toLowerCase();
  if (!CODE.test(clean)) return false;
  try {
    storage.setItem(KEY, JSON.stringify({ code: clean, at: now } satisfies Saved));
    return true;
  } catch {
    return false;
  }
}

/** The remembered code, or null when there is none or it is too old. */
export function readInvite(storage: Storage, now: number = Date.now()): string | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const { code, at } = JSON.parse(raw) as Partial<Saved>;
    if (typeof code !== "string" || !CODE.test(code) || typeof at !== "number" || now - at > INVITE_TTL_MS) return null;
    return code;
  } catch {
    return null;
  }
}

/** Reads the code once and forgets it, so it is only ever sent one time. */
export function takeInviteCode(storage: Storage, now: number = Date.now()): string | null {
  const code = readInvite(storage, now);
  try {
    storage.removeItem(KEY);
  } catch {
    // Storage blocked: nothing to forget.
  }
  return code;
}
