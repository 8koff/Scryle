import Anthropic from "@anthropic-ai/sdk";

/**
 * Server-side Claude client. Reads ANTHROPIC_API_KEY, plus ANTHROPIC_WORKSPACE_ID
 * when the key is an organization-level key that is not scoped to a workspace.
 */
export function anthropicFromEnv(env: Record<string, string | undefined> = process.env): Anthropic {
  const apiKey = env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
  const workspaceId = env.ANTHROPIC_WORKSPACE_ID?.trim();
  return new Anthropic({
    apiKey,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
}
