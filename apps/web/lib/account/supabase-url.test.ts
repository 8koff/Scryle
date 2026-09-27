import { describe, expect, it } from "vitest";
import { supabaseProjectUrl } from "./supabase-url";

describe("supabaseProjectUrl", () => {
  it("strips the REST path and trailing slashes", () => {
    expect(supabaseProjectUrl("https://abc.supabase.co/rest/v1/")).toBe("https://abc.supabase.co");
    expect(supabaseProjectUrl("https://abc.supabase.co/")).toBe("https://abc.supabase.co");
    expect(supabaseProjectUrl(" https://abc.supabase.co ")).toBe("https://abc.supabase.co");
  });

  it("returns undefined when empty", () => {
    expect(supabaseProjectUrl("")).toBeUndefined();
    expect(supabaseProjectUrl(undefined)).toBeUndefined();
  });
});
