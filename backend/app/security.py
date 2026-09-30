"""Security middleware stack for BioStream.

Three layers, added in order (CORS is added first in main.py so preflight
requests are answered before any enforcement):

1. SecurityHeadersMiddleware — CSP + hardening headers, plus an early
   content-length check that rejects oversized bodies before parsers run.
2. CsrfProtectMiddleware — double-submit-cookie CSRF protection on every
   state-changing method.
3. RateLimitMiddleware — per-client-IP token bucket (in-memory; fine for a
   single instance — see README for multi-worker notes).
"""
from __future__ import annotations

import hmac
import secrets
import time
from collections import defaultdict

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from .config import get_settings

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_COOKIE = "biostream_csrf"
CSRF_HEADER = "X-CSRF-Token"
_MAX_BODY_BYTES = 5_000_000  # 5 MB cap on request bodies

# Swagger UI needs its CDN + inline assets; everything else gets the strict CSP.
_DOCS_CSP = (
    "default-src 'self' cdn.jsdelivr.net; "
    "script-src 'self' cdn.jsdelivr.net 'unsafe-inline'; "
    "style-src 'self' cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' data:; connect-src 'self'"
)
_API_CSP = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length", "0")
        if content_length.isdigit() and int(content_length) > _MAX_BODY_BYTES:
            return JSONResponse({"detail": "Request body too large."}, status_code=413)
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        path = request.url.path
        if path.startswith(("/api/docs", "/api/redoc")):
            response.headers["Content-Security-Policy"] = _DOCS_CSP
        else:
            response.headers["Content-Security-Policy"] = _API_CSP
        return response


class CsrfProtectMiddleware(BaseHTTPMiddleware):
    """Double-submit-cookie CSRF protection.

    Any safe (GET/HEAD/OPTIONS) response sets a random token in a SameSite=Lax,
    non-HttpOnly cookie. State-changing requests must echo the same value in the
    `X-CSRF-Token` header. A cross-site attacker can neither read the cookie
    (CORS + SameSite) nor forge the header, and a cross-site form POST will not
    carry the Lax cookie. `hmac.compare_digest` makes the comparison constant-time.
    """

    async def dispatch(self, request: Request, call_next):
        if request.method in SAFE_METHODS:
            response = await call_next(request)
            cookie_token = request.cookies.get(CSRF_COOKIE)
            if not cookie_token:
                cookie_token = secrets.token_urlsafe(32)
                response.set_cookie(
                    CSRF_COOKIE,
                    cookie_token,
                    samesite="lax",
                    httponly=False,  # the page's JS must read it to echo it back
                    secure=False,    # localhost is http; set True behind TLS
                    max_age=86400,
                )
            return response

        cookie_token = request.cookies.get(CSRF_COOKIE, "")
        header_token = request.headers.get(CSRF_HEADER, "")
        if not cookie_token or not hmac.compare_digest(cookie_token, header_token):
            return JSONResponse({"detail": "Missing or invalid CSRF token."}, status_code=403)
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple per-client-IP sliding-window limiter, scoped to /api."""

    def __init__(self, app, per_minute: int = 120, trust_proxy: bool = False) -> None:
        super().__init__(app)
        self.per_minute = per_minute
        self.trust_proxy = trust_proxy
        self._hits: defaultdict[str, list[float]] = defaultdict(list)

    def _client(self, request: Request) -> str:
        if self.trust_proxy:
            fwd = request.headers.get("x-forwarded-for")
            if fwd:
                return fwd.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/api"):
            now = time.monotonic()
            client = self._client(request)
            hits = [t for t in self._hits[client] if now - t < 60.0]
            self._hits[client] = hits
            if len(hits) >= self.per_minute:
                return JSONResponse({"detail": "Rate limit exceeded. Retry shortly."}, status_code=429)
            hits.append(now)
        return await call_next(request)
