import { describe, expect, it } from "vitest";
import { renderModelFromEnv } from "./defaults";

describe("renderModelFromEnv", () => {
  it("defaults to the cheap Marketing Studio setting", () => {
    expect(renderModelFromEnv({})).toBe("marketing-low");
  });

  it("accepts a known override", () => {
    expect(renderModelFromEnv({ RENDER_MODEL: "qwen-1k" })).toBe("qwen-1k");
  });

  it("rejects an unknown or removed model", () => {
    expect(() => renderModelFromEnv({ RENDER_MODEL: "grok" })).toThrow(/not one of/);
  });
});
