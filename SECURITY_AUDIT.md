# BioStream — Security Audit & Vulnerability Mitigation

**Scope:** the full BioStream stack — `frontend/` (Next.js 14 + React + R3F + GSAP) and
`backend/` (FastAPI + httpx) — as committed in this repository.
**Date of audit:** 2026-09-30. **Auditor note:** this is a code-review + automated-test
audit performed during development, not an external penetration test. Every claim below is
backed by either a regression test in `backend/tests/`, a live probe against the running
service, or a static construction argument; where a control is a recommendation rather than
implemented code, it is explicitly marked.

---

## 1. Threat model

| # | Asset | Threat | Vector | Mitigation | Status |
|---|-------|--------|--------|------------|--------|
| T1 | API keys (Ensembl, Anthropic, Pinecone) | Leakage to the client | Accidental `NEXT_PUBLIC_*` prefix, env file committed, `/api/health` echoing config | Server-only `pydantic-settings`; `/api/health` returns booleans only; `.gitignore` blocks `.env*`; docs enumerate placement | Implemented + tested (`test_health_is_public_and_sets_cookie`) |
| T2 | Sequence/alignment views | XSS | Hostile FASTA/PDB content rendered as HTML | React escapes all text; zero `dangerouslySetInnerHTML`; CSP; backend never echoes raw input | Implemented + tested |
| T3 | State-changing endpoints | CSRF | Cross-site form POST / fetch without token | Double-submit cookie (`SameSite=Lax`, constant-time compare) + `X-CSRF-Token` header on every non-safe method; CORS origin allowlist | Implemented + tested |
| T4 | FASTA / PDB ingestion | Injection (HTML, SQL-ish, control chars, DoS) | Malformed or oversized uploads | Whitelist parsers, size caps, bounded numeric parsing, fail-closed 422s with safe messages | Implemented + tested |
| T5 | Upstream URLs | SSRF / path traversal | Identifier abuse (`../../`, `;rm`, encoded junk) | Strict regex on every path/query identifier **before** URL construction; upstream base URLs are server config, never client input | Implemented + tested |
| T6 | API availability | DoS | Request floods, oversized bodies | Per-IP sliding-window rate limit (429), 5 MB body cap (413), 25 MB PDB cap, 2 MB FASTA cap, parse-time atom caps | Implemented + tested |
| T7 | Clickjacking / MIME confusion / referrer leak | Header hardening | Frames, sniffing, referrer metadata | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cache-Control: no-store`, CSP on both tiers | Implemented |

---

## 2. API key leakage (T1)

**Rule: a secret exists in exactly one place — `backend/.env` — and never crosses the
network boundary.**

- All credentials are loaded by `backend/app/config.py` via `pydantic-settings`
  (`ANTHROPIC_API_KEY`, `PINECONE_API_KEY`, `ENSEMBL_API_KEY`, …). Nothing in that module
  is serialized into any response.
- `GET /api/health` exposes only `configured_services` — a dict of booleans
  ("is an LLM configured?") that leaks no key material. Regression test asserts the
  response body contains neither `sk-ant` nor `api_key` strings.
- The frontend's only public variable is `NEXT_PUBLIC_API_BASE_URL` (the backend origin).
  `frontend/.env.local.example` documents that anything prefixed `NEXT_PUBLIC_` is inlined
  into the JS bundle, and that all secret keys belong in `backend/.env` instead.
- `.gitignore` excludes `.env`, `.env.local`, `.env.*.local` (examples are whitelisted back
  in with `!*.example`). **Action required:** this audit found that the first commit had
  tracked a `cookies.txt` containing a dev CSRF token plus several debug JSON dumps under
  `backend/`. They contain no production secrets but should be removed from history with
  `git rm --cached` before any public push (see §8).
- No upstream key is required for the current integrations (UniProt, Ensembl, InterPro,
  AlphaFold DB, AlphaMissense hotspot API, VEP are all keyless public endpoints). The
  optional keys are wired for future agentic features and are dormant until set.
- Request headers are never logged; upstream error messages are truncated to 200 chars
  before being returned (`routes/variants.py` guard) so upstream bodies cannot reflect
  sensitive content.

**Verified by:** `tests/test_security.py::TestCsrf::test_health_is_public_and_sets_cookie`,
live probe of `/api/health` (booleans only), grep for `dangerouslySetInnerHTML` (zero hits)
and `NEXT_PUBLIC_` (one hit: the API base URL).

---

## 3. Cross-site scripting (T2)

**The XSS posture has three independent layers:**

1. **No unsanitized HTML, ever.** Every user/upstream-derived string — FASTA headers,
   sequence text, PDB titles, gene names, error messages — is rendered through React
   JSX text nodes or per-character `<span>`s (`AlignmentViewer` renders each residue as its
   own span). React's escaping means `<script>alert(1)</script>` in a sequence renders as
   literal text. There is **no** `dangerouslySetInnerHTML` in the codebase.
2. **Input never reaches the DOM as markup.** The backend's 422 handler was deliberately
   overridden (`main.py::validation_exception_handler`) because FastAPI's default echoes
   the *raw offending input* back into the error JSON — a reflected-XSS footgun. Our
   handler returns only parameter locations and fixed messages. Tests assert hostile
   payloads are rejected and never echoed.
3. **CSP as the backstop.** The backend serves `default-src 'none'; frame-ancestors 'none';
   base-uri 'none'; form-action 'none'` on API responses (docs paths get a separate,
   narrowly-scoped CSP for Swagger's CDN). The frontend ships a production CSP of
   `script-src 'self'` (dev adds `'unsafe-eval'` for HMR), `object-src 'none'`,
   `frame-ancestors 'none'`, `form-action 'self'`. Even if a stray `innerHTML` were
   introduced, inline script execution would be blocked.

**Verified by:** `TestInjection::test_malformed_sequences_rejected` (7 payload classes:
`<script>`, SQL-style, header smuggling, NUL byte, backtick injection, emoji, 3 KB
oversize — all 422, none echoed); `test_fasta_rejects_script_payload` /
`test_fasta_rejects_sql_payload`; static grep across the repo.

---

## 4. Cross-site request forgery (T3)

**Scheme: double-submit cookie + constant-time compare + origin allowlist.**

- Any safe (GET/HEAD/OPTIONS) response ensures a `biostream_csrf` cookie exists:
  random 256-bit token, `SameSite=Lax`, `max_age` 24 h, non-HttpOnly (deliberate — the
  double-submit pattern requires the page's JS to read and echo it), `Secure` to be
  enabled behind TLS (flag exists in `config.py`).
- Every non-safe request must present the same value in `X-CSRF-Token`; comparison uses
  `hmac.compare_digest` (constant-time). Mismatch or absence → 403 with a fixed message.
- `SameSite=Lax` means a cross-site form POST never carries the cookie at all, so the
  double-submit comparison can never be satisfied cross-site.
- CORS (`allow_origins` from `CORS_ORIGINS` config, `allow_credentials=True`,
  allowlisted methods/headers) prevents a cross-origin page from *reading* the cookie or
  the token response. Note CORS is not CSRF protection by itself — it protects the token,
  while the cookie+header scheme protects the state change.
- The frontend client (`lib/api.ts`) sends `credentials: "include"`, echoes the cookie as
  the header on mutations, and on a 403 retries once after a safe GET (first-visit
  bootstrap, where no cookie exists yet).
- There are no state-changing GETs; every mutating route is POST.

**Verified by:** `TestCsrf` — post without token → 403, forged token → 403, valid token →
200, cookie length ≥ 32.

---

## 5. Injection in FASTA / PDB parsing (T4)

**Philosophy: fixed-width parsing, whitelist characters, bounded numerics, hard caps,
fail-closed errors that never echo input.**

`backend/app/parsers.py`:

- **FASTA:** 2 MB cap checked before parsing; headers must match a strict one-line
  pattern; sequence characters are validated against a whitelist
  (`A–Z * - _ .`); anything else — HTML tags, SQL fragments, NUL bytes, emoji — raises
  `ParseError` and the request ends in 422. Sequences capped at 20,000 residues.
- **PDB:** 25 MB cap before parsing. Records are parsed by **fixed column slicing** per
  the PDB specification (the grammar is positional, not regex-based). Only
  `ATOM`/`HETATM`/`TITLE`/`SITE` records are consumed; every numeric field goes through a
  bounded `float()`/`int()` inside `try/except` — malformed coordinates are skipped, never
  guessed, and non-finite values (NaN/Inf) are rejected. Atom count is capped.
- **Alignment:** sequences validated by regex `^[A-Z*\-_.]+$` and length (2,000) in the
  Pydantic layer *before* the Needleman–Wunsch kernel (which is additionally capped at
  1,500 residues and uses compact `array('i')` rows to bound memory).
- **No dynamic code execution anywhere:** no `eval`/`exec`, no `subprocess`/shell calls,
  no SQL database, no template rendering of input. The only thing a hostile FASTA can do
  is be rejected.

**Verified by:** `tests/test_parsers.py` (script/SQL payloads, malformed coordinates,
oversize via monkeypatched caps, sequence-before-header) + `TestInjection` (route-level).

---

## 6. SSRF / path traversal on upstream URLs (T5)

Every identifier that reaches an upstream URL passes a strict pattern **before** URL
construction:

| Input | Pattern | Where |
|---|---|---|
| PDB ID | `^[0-9A-Za-z]{4}$` | `routes/structure.py` |
| UniProt accession (path) | `^[A-Z0-9]{1,20}$` | `routes/ingest.py`, `structure.py` |
| Gene symbol | `^[A-Za-z0-9]{1,20}$` | `routes/comparative.py`, `ingest.py` |
| Species | `^[a-z_]{3,40}$` | `ingest.py` |
| Ensembl gene (from upstream!) | `^ENSG\d{11}$` | `services/ensembl.py`, `vep.py` |
| Variant fields | Pydantic patterns + ranges | `routes/schemas.py` |

The Ensembl gene ID is itself *upstream data* (UniProt cross-references), so it is
re-validated against `ENSG\d{11}` before being interpolated into a URL — defense in depth
against a compromised upstream response. Upstream base URLs come exclusively from server
config; the client can never supply a URL. All httpx calls use bounded timeouts.

**Verified by:** `TestInjection::test_pdb_path_traversal_rejected` and
`test_accession_injection_rejected` (encoded traversal, SQL-ish suffixes, NUL bytes,
oversize — all 404/422).

---

## 7. DoS controls (T6)

- Body cap: 5 MB at the middleware (413) — before routing, parsing, or JSON decoding.
- Rate limit: per-IP sliding window (default 120 req/min, configurable), 429 on breach.
  In-memory and per-process — correct for the single-worker dev/deploy profile; for
  multi-worker production use a shared store (see §8).
- Parse caps: FASTA 2 MB / 20k residues, PDB 25 MB / 300k atoms, writhe downsampled to
  ≤160 points (the Gauss-integral kernel is O(n²) — downsampling keeps it bounded),
  alignment 1,500 residues.
- Upstream timeouts: 25 s default, 90 s for large model downloads, a dedicated 120 s
  window for Ensembl (whose legacy hosts currently answer healthy calls in 60–200 s —
  verified live 2026-09-30), and a 180 s variant deadline with per-source degradation.
  Only successful upstream results are cached (negative caching would poison retries).

**Verified by:** `TestLimits::test_oversized_body_rejected_413`,
`test_rate_limit_enforced` (4th request in the window → 429).

---

## 8. Residual risks & required actions

1. **⚠ Debug artifacts in git history.** `backend/cookies.txt` (a dev CSRF token dump)
   and `cmp*.json` / `var*.json` / `rcsb.json` (upstream response dumps) were committed in
   the first commit. No production secrets are inside, but remove them before any public
   push: `git rm --cached backend/cookies.txt backend/cmp*.json … && git commit`.
   `.gitignore` now prevents recurrence.
2. **CSRF cookie is not `Secure`** — correct for `http://localhost`; set
   `CSRF_COOKIE_SECURE=true` in `config.py` (currently hardcoded `secure=False`) and serve
   behind TLS before deploying anywhere reachable.
3. **No authentication layer.** There are no user accounts; rate limiting is per-IP.
   Before hosting publicly, add OIDC/API-token auth and scope rate limits per principal.
4. **Rate-limit and TTL caches are in-memory.** Fine for one uvicorn worker. Multi-worker
   deployment needs Redis (the `TTLCache` API is already shaped for a swap).
5. **Frontend CSP hardcodes `connect-src http://localhost:8000`** for local dev. For any
   deployed origin, update `frontend/next.config.js` (ideally serve the API same-origin
   through a Next.js rewrite) and remove `'unsafe-eval'` from any non-dev script-src.
6. **Upstream trust:** we display upstream annotations as-is (with graceful per-source
   degradation). Field-level provenance is not currently shown in the UI; consider
   surfacing `status`/`detail` chips per source (the data model already carries them).
7. **Automated tooling (recommended):** add `pip-audit` for Python deps, `npm audit` /
   `next lint` in CI, `bandit` on the backend, and keep the regression suite
   (`pytest tests/`) as a merge gate. The current suite is the enforceable subset.
8. **Secrets rotation:** if the repo was ever pushed with `.env` present, rotate any keys
   in it. The committed artifacts above contain none.

## 9. How to re-verify

```bash
# Backend: 42 offline security + numerics tests
cd backend
python -m venv .venv && .venv/Scripts/python -m pip install -r requirements-dev.txt
.venv/Scripts/python -m pytest tests -q

# Live probes (server running on :8000)
curl -s http://localhost:8000/api/health                          # booleans only
curl -s -X POST http://localhost:8000/api/alignment/pairwise \
  -H 'Content-Type: application/json' \
  -d '{"sequence_a":"ACGT","sequence_b":"ACGT"}'                  # 403 without CSRF token
curl -s http://localhost:8000/api/structure/rcsb/..%2F..%2Fetc   # 422/404, no echo

# Frontend: production build must succeed with the strict CSP in place
cd frontend && npm run build
```

**Audit result:** no critical or high findings outstanding in the code as audited;
eight hardening actions are listed in §8, of which items 1–2 are the only pre-share
must-dos.
