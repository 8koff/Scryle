import { describe, expect, it } from "vitest";
import { INVITE_TTL_MS, readInvite, saveInvite, takeInviteCode } from "./invite-store";

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

describe("invite store", () => {
  it("remembers a code from the link and hands it over once", () => {
    const storage = memoryStorage();
    expect(saveInvite(storage, " AbCd2345 ", 0)).toBe(true);
    expect(readInvite(storage, 1)).toBe("abcd2345");
    expect(takeInviteCode(storage, 1)).toBe("abcd2345");
    expect(takeInviteCode(storage, 1)).toBeNull();
  });

  it("ignores codes that don't look right", () => {
    const storage = memoryStorage();
    expect(saveInvite(storage, "<script>", 0)).toBe(false);
    expect(readInvite(storage, 0)).toBeNull();
  });

  it("forgets an invite after 30 days", () => {
    const storage = memoryStorage();
    saveInvite(storage, "abcd2345", 0);
    expect(readInvite(storage, INVITE_TTL_MS + 1)).toBeNull();
  });
});
