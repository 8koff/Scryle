import { describe, expect, it } from "vitest";
import { anthropicFromEnv } from "./anthropic";

describe("anthropicFromEnv", () => {
  it("requires an API key", () => {
    expect(() => anthropicFromEnv({})).toThrow(/ANTHROPIC_API_KEY/);
  });

  it("sends the workspace header when a workspace id is set", async () => {
    let seen: Headers | undefined;
    const client = anthropicFromEnv({ ANTHROPIC_API_KEY: "sk-ant-api-test", ANTHROPIC_WORKSPACE_ID: "wrkspc_123" });
    const withFetch = client.withOptions({
      fetch: async (_url: string | URL | Request, init?: RequestInit) => {
        seen = new Headers(init?.headers);
        return new Response(JSON.stringify({ data: [], has_more: false, first_id: null, last_id: null }), {
          headers: { "content-type": "application/json" },
        });
      },
      maxRetries: 0,
    });

    await withFetch.models.list();

    expect(seen?.get("anthropic-workspace-id")).toBe("wrkspc_123");
  });
});
