"""BioStream FastAPI application.

Run:  python -m uvicorn app.main:app --reload --port 8000
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.requests import Request

from .config import Settings, get_settings
from .routes import alignment, comparative, ingest, structure, variants
from .security import CsrfProtectMiddleware, RateLimitMiddleware, SecurityHeadersMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    s = settings or get_settings()
    app = FastAPI(
        title="BioStream API",
        description="Protein sequence alignment, structural analysis and variant impact prediction.",
        version="0.1.0",
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        """Fail closed WITHOUT echoing hostile input back into the response body.

        FastAPI's default 422 handler embeds the raw offending value (`"input"`)
        and pydantic internals in the response — a reflected-XSS footgun. We
        report only the parameter location and a fixed message.
        """
        errors = [
            {"loc": ".".join(str(p) for p in e.get("loc", [])), "msg": e.get("msg", "invalid value")}
            for e in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": "Validation failed.", "errors": errors})
    # CORS first (outermost) so preflight is answered before CSRF enforcement.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(CsrfProtectMiddleware)
    app.add_middleware(RateLimitMiddleware, per_minute=s.rate_limit_per_minute, trust_proxy=s.trust_proxy)

    for module in (alignment, comparative, ingest, structure, variants):
        app.include_router(module.router, prefix="/api")

    @app.get("/api/health")
    async def health() -> dict:
        return {"status": "ok", "version": "0.1.0", "services": s.configured_services}

    return app


app = create_app()
