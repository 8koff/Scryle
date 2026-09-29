import type { ApiResponse } from "@retrofit/core";
import { account } from "./use-account";

export type Loaded<T> = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

const OFFLINE = "Couldn't reach Scryle. Check your connection and try again.";

/**
 * Calls our API as the signed-in person and unwraps the { success, data } envelope.
 * Never throws: every failure comes back as a message the screen can show.
 */
export async function getApi<T>(path: string, init?: RequestInit): Promise<Loaded<T>> {
  try {
    const response = await account.authFetch(path, init);
    const body = (await response.json()) as ApiResponse<T>;
    if (body.success) return { status: "ready", data: body.data };
    return { status: "error", message: body.error || "Something went wrong. Please try again." };
  } catch {
    return { status: "error", message: OFFLINE };
  }
}
