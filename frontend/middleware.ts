import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Per-request CSP with a nonce (Next 14.2 official pattern).
 *
 * Next.js emits inline bootstrap scripts for hydration; a static
 * `script-src 'self'` header blocks them and the page never hydrates.
 * Here a fresh base64 nonce is generated per request, passed to Next via the
 * `x-nonce` request header (Next stamps it onto every inline script it emits),
 * and allowed in the CSP. `'unsafe-inline'` for scripts is never used.
 *
 * The remaining hardening headers (X-Frame-Options, nosniff, …) are static and
 * stay in next.config.js.
 */
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isProd = process.env.NODE_ENV === "production";

  const csp = [
    "default-src 'self'",
    // Next dev HMR needs eval; production stays strict.
    `script-src 'self' 'nonce-${nonce}'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:3000",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
