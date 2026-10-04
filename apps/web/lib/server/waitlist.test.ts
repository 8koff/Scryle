import { describe, expect, it } from "vitest";
import { createMemoryWaitlistStore, handleWaitlistJoin } from "./waitlist";

const OK = { status: 200, body: { success: true } };

describe("handleWaitlistJoin", () => {
  it("saves the email in lower case, with where it came from", async () => {
    const store = createMemoryWaitlistStore();
    const result = await handleWaitlistJoin({ email: "  Sam@Example.com ", source: "X" }, store);
    expect(result).toEqual(OK);
    expect(store.rows).toEqual([{ email: "sam@example.com", source: "x" }]);
  });

  it("gives the same answer when the email is already on the list", async () => {
    const store = createMemoryWaitlistStore();
    await handleWaitlistJoin({ email: "sam@example.com" }, store);
    const again = await handleWaitlistJoin({ email: "SAM@example.com" }, store);
    expect(again).toEqual(OK);
    expect(store.rows).toHaveLength(1);
  });

  it("refuses something that is not an email", async () => {
    const store = createMemoryWaitlistStore();
    for (const email of ["", "sam", "sam@", 42, "a".repeat(250) + "@x.io"]) {
      const result = await handleWaitlistJoin({ email }, store);
      expect(result.status).toBe(400);
    }
    expect(await handleWaitlistJoin(null, store)).toMatchObject({ status: 400 });
    expect(store.rows).toHaveLength(0);
  });

  it("drops an odd source instead of refusing the email", async () => {
    const store = createMemoryWaitlistStore();
    await handleWaitlistJoin({ email: "sam@example.com", source: "<script>" }, store);
    await handleWaitlistJoin({ email: "kim@example.com", source: 7 }, store);
    expect(store.rows.map((r) => r.source)).toEqual(["", ""]);
  });

  it("says yes to bots that fill in the hidden field, but saves nothing", async () => {
    const store = createMemoryWaitlistStore();
    const result = await handleWaitlistJoin({ email: "bot@example.com", website: "http://spam.example" }, store);
    expect(result).toEqual(OK);
    expect(store.rows).toHaveLength(0);
  });
});
