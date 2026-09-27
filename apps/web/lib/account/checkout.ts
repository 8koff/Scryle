import type { CreditPackId } from "@retrofit/core";
import type { ApiResponse, CheckoutStart } from "@/lib/api";

type AuthFetch = (url: string, init?: RequestInit) => Promise<Response>;

/**
 * Opens Stripe's payment page for one pack. Stripe sends the buyer back to `returnTo`.
 * Returns an error message when it couldn't start; on success the page is already leaving.
 */
export async function startCheckout(
  pack: CreditPackId,
  returnTo: string,
  authFetch: AuthFetch,
  go: (url: string) => void = (url) => window.location.assign(url),
): Promise<string | null> {
  try {
    const response = await authFetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pack, returnTo }),
    });
    const body = (await response.json()) as ApiResponse<CheckoutStart>;
    if (!body.success) return body.error || "Payments aren't working right now. Please try again.";
    go(body.data.url);
    return null;
  } catch {
    return "Payments aren't working right now. Please try again.";
  }
}
