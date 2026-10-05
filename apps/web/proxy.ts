import { NextResponse, type NextRequest } from "next/server";
import { contentSecurityPolicy, createNonce, SECURITY_HEADERS } from "@/lib/security/csp";
import { waitlistRedirect } from "@/lib/site-mode";

/**
 * Adds the Content Security Policy to every page. Next.js reads the nonce from the request
 * header and puts it on its own scripts (see the CSP guide in node_modules/next/dist/docs).
 * In waitlist-only mode (lib/site-mode.ts), closed pages redirect to /waitlist first.
 */
export function proxy(request: NextRequest) {
  const closedTo = waitlistRedirect(request.nextUrl.pathname);
  // 307: temporary, so search engines keep the pages for when the site opens again.
  if (closedTo) return NextResponse.redirect(new URL(closedTo, request.url), 307);

  const nonce = createNonce();
  const policy = contentSecurityPolicy({
    nonce,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    isDev: process.env.NODE_ENV === "development",
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", policy);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not API routes, build files, images or the public/ folder.
      source: "/((?!api|_next/static|_next/image|favicon.ico|demo/).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
