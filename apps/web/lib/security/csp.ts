import { supabaseProjectUrl } from "@/lib/account/supabase-url";

/** Where Higgsfield keeps photos and finished renders (same list the share code trusts). */
const HIGGSFIELD_HOSTS = ["https://*.cloudfront.net", "https://*.higgsfield.ai"];
/** The on-device detector downloads its model from here. */
const MODEL_HOST = "https://storage.googleapis.com";

/** A fresh, unguessable value for each page load. */
export function createNonce(): string {
  return btoa(crypto.randomUUID());
}

/**
 * The Content Security Policy. Scripts only run with this request's nonce, so an injected
 * script can't read the sign-in token. Styles allow inline because React writes style
 * attributes; that can't run code.
 */
export function contentSecurityPolicy({
  nonce,
  supabaseUrl,
  isDev,
}: {
  nonce: string;
  supabaseUrl?: string;
  isDev: boolean;
}): string {
  const supabase = supabaseProjectUrl(supabaseUrl);
  const supabaseHosts = supabase ? [supabase, supabase.replace(/^https:/, "wss:")] : [];
  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    // Dev needs eval for React's error overlay; production never does.
    "script-src": ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'", ...(isDev ? ["'unsafe-eval'"] : [])],
    "style-src": ["'self'", "'unsafe-inline'"],
    // Any https image: product photos come from many stores, and an image can't run code.
    "img-src": ["'self'", "blob:", "data:", "https:"],
    "media-src": ["'self'", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...supabaseHosts, ...HIGGSFIELD_HOSTS, MODEL_HOST, ...(isDev ? ["ws:"] : [])],
    "worker-src": ["'self'", "blob:"],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };
  const policy = Object.entries(directives).map(([name, values]) => `${name} ${values.join(" ")}`);
  if (!isDev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

/** Headers every page gets alongside the policy. The camera stays allowed for this site only. */
export const SECURITY_HEADERS: Record<string, string> = {
  // HTTPS only. No includeSubDomains/preload: those bind every subdomain and are hard to undo.
  "Strict-Transport-Security": "max-age=63072000",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=()",
};
