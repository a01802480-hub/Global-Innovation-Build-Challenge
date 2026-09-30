# BioStream 🧬

A unified, web-based workspace for protein sequence alignment, structural analysis and
variant impact prediction — built for the **Global Innovation Build Challenge** with an
"Antigravity" UI: glassmorphic floating panels, isometric tool cards, GSAP scroll motion
and an interactive React Three Fiber structure viewer.

```
┌─────────────────────────── Browser ───────────────────────────┐
│  Next.js 14 (App Router) · Tailwind · GSAP + ScrollTrigger    │
│  React Three Fiber viewer (backbone tube, writhe, markers)    │
│  NEXT_PUBLIC_API_BASE_URL  ──────────────┐   │
└───────────────────────────────────────────┼───────────────────┘
                                            ▼
┌─────────────────────────── FastAPI :8000 ─────────────────────┐
│  CSRF double-submit · rate limit · size caps · strict CSP     │
│  routes: structure · comparative · variants · alignment · ingest
│  services: UniProtKB · Ensembl · InterPro · AlphaFold DB      │
│           AlphaMissense · VEP(SIFT)  ← server-side keys only  │
└───────────────────────────────────────────────────────────────┘
```

**Research preview — aggregations of public annotations are not clinical interpretation.**

---

## 1. Features

| Workspace | What it does |
|---|---|
| **Structure** (`/workspace/structure`) | R3F viewer of the Cα backbone, colored by chain / pLDDT / **local writhe** (Gauss linking integral, validated against Hopf-link linking numbers). LIG1 (`1X9N`) and RuBisCO (`8RUC`) presets; RuBisCO catalytic residues (KCX201, Asp203, Glu204…) and Mg²⁺ ions rendered as labeled markers. |
| **Comparative** (`/workspace/comparative`) | Human ↔ blue-whale orthologs for BER-pathway genes (LIG1, PNKP): Ensembl homology (UniProt-curated gene ID to dodge the LIG1/LRIG1 synonym collision), InterPro domain track, pairwise Needleman–Wunsch alignment. |
| **Variants** (`/workspace/variants`) | One substitution → AlphaFold pLDDT (B-factor from the model file), AlphaMissense pathogenicity (hegelab hotspot API), SIFT/PolyPhen (Ensembl VEP). Each source degrades independently; transparent consensus meter. |

Security posture and the audit trail: **[SECURITY_AUDIT.md](SECURITY_AUDIT.md)**.

## 2. Repository layout

```
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app, middleware stack, 422 fail-closed handler
│   │   ├── config.py          # pydantic-settings — ALL secrets live here
│   │   ├── security.py        # CSRF double-submit · rate limit · headers · body cap
│   │   ├── parsers.py         # strict FASTA + PDB parsers (injection-safe)
│   │   ├── writhe.py          # Gauss-integral writhe + local writhe
│   │   ├── align.py           # Needleman–Wunsch (pure Python, bounded memory)
│   │   ├── cache.py           # thread-safe TTL cache
│   │   ├── routes/            # structure · comparative · variants · alignment · ingest
│   │   └── services/          # uniprot · ensembl · interpro · alphafold · alphamissense · vep
│   ├── tests/                 # 42 tests: security regressions + parser + writhe numerics
│   ├── requirements.txt / requirements-dev.txt
│   ├── .env.example           # ← template for backend/.env
│   └── Dockerfile
├── frontend/
│   ├── app/                   # landing + workspace pages (App Router)
│   │   ├── workspace/structure|comparative|variants/
│   ├── components/
│   │   ├── antigravity/       # FloatIn (GSAP stagger) · GlassCard · IsometricTilt · Parallax
│   │   ├── three/             # ProteinViewer (R3F) · HeroScene
│   │   ├── landing/           # Hero · ToolGrid · PipelineBand · SequenceDeck
│   │   └── workspace/         # AlignmentViewer · DomainTrack · ScoreCard · PlddtStrip …
│   ├── lib/                   # api client (CSRF-aware) · geometry (tube builder) · format
│   ├── .env.local.example     # ← template for frontend/.env.local
│   ├── next.config.js         # strict CSP + hardening headers
│   └── tailwind.config.ts
├── SECURITY_AUDIT.md
└── .gitignore
```

## 3. Prerequisites

- **Python 3.12+** (verified on 3.14) — `python --version`
- **Node.js 20+** (verified on 24) — `node --version`
- Internet access (upstream APIs are public and keyless)

## 4. Run the backend (FastAPI, port 8000)

```powershell
cd backend

# 1. Create + activate the virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# 2. Install dependencies
python -m pip install -r requirements-dev.txt

# 3. Create your environment file
Copy-Item .env.example .env        # then edit .env if you have keys (see §6)

# 4. Run the test suite (42 tests, offline) — optional but recommended
python -m pytest tests -q

# 5. Start the server
python -m uvicorn app.main:app --reload --port 8000
```

Check it: <http://localhost:8000/api/health> (returns service booleans, never keys) and
the interactive docs at <http://localhost:8000/api/docs>.

## 5. Run the frontend (Next.js, port 3000)

```powershell
cd frontend

# 1. Install dependencies
npm install

# 2. Create your environment file
Copy-Item .env.local.example .env.local

# 3. Start the dev server
npm run dev
```

Open <http://localhost:3000>. The landing page loads instantly; the workspace tools call
the backend at `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:8000`).

**First-request note:** state-changing calls bootstrap the CSRF cookie automatically
(the client retries one 403 after a safe GET) — no manual setup.

## 6. Where every key goes (the only correct answer)

**One rule: anything prefixed `NEXT_PUBLIC_` is inlined into the browser JS bundle.**
No secret may ever carry that prefix. All secrets live in `backend/.env`.

### `backend/.env` (server-only — complete template)

```ini
# ── Public data services (keyless — these are just URLs) ─────────────────────
UNIPROT_BASE_URL=https://rest.uniprot.org
ENSEMBL_BASE_URL=https://rest.ensembl.org
INTERPRO_BASE_URL=https://www.ebi.ac.uk/interpro/api
ALPHAMISSENSE_BASE_URL=https://alphamissense.hegelab.org
ALPHAFOLD_BASE_URL=https://alphafold.ebi.ac.uk/api

# ── Optional credentials — SERVER-SIDE ONLY, never sent to the client ────────
# Ensembl REST is keyless; set this only for a privileged mirror.
ENSEMBL_API_KEY=

# ── Agentic features (planned; dormant until set) ─────────────────────────────
ANTHROPIC_API_KEY=
PINECONE_API_KEY=
PINECONE_ENVIRONMENT=

# ── Application behaviour ─────────────────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
ORTHOLOG_SPECIES=balaenoptera_musculus,balaenoptera_acutorostrata,physeter_catodon
RATE_LIMIT_PER_MINUTE=120
REQUEST_TIMEOUT_S=25
ENSEMBL_TIMEOUT_S=120
VARIANT_TIMEOUT_S=180
TRUST_PROXY=false
```

### `frontend/.env.local` (client-safe — complete template)

```ini
# The ONLY public value in the frontend. Never put a secret here.
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Key placement table

| Credential / setting | File | Exposed to client? |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` (backend origin) | `frontend/.env.local` | ✅ yes, by design — it is not a secret |
| `UNIPROT_BASE_URL` (no key needed) | `backend/.env` | ❌ server-side |
| `ENSEMBL_BASE_URL` / `ENSEMBL_API_KEY` (keyless public REST; key optional) | `backend/.env` | ❌ server-side |
| `INTERPRO_BASE_URL` (keyless) | `backend/.env` | ❌ server-side |
| `ALPHAMISSENSE_BASE_URL` (hotspot API is keyless) | `backend/.env` | ❌ server-side |
| `ALPHAFOLD_BASE_URL` (AlphaFold DB, keyless) | `backend/.env` | ❌ server-side |
| `ANTHROPIC_API_KEY` (agentic LLM features) | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |
| `PINECONE_API_KEY` / `PINECONE_ENVIRONMENT` (vector store) | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |
| Any future per-service token | `backend/.env` | ❌ **never** `NEXT_PUBLIC_` |

Why this works: the browser only ever talks to *your* backend (same origin in a real
deployment; localhost in dev). The backend holds the keys and makes the upstream calls —
the client cannot leak what it never receives. `/api/health` exposes only booleans
("is an LLM configured?"), never values.

## 7. Motion & accessibility rules (the Antigravity contract)

- **Never snap instantly** — every transition is ≥ 0.3 s `ease-out`; GSAP entrances run
  `power3.out`, staggers at 0.1 s.
- **Transform-only animation** — `will-change: transform`; filters/layout properties are
  never animated continuously.
- **`prefers-reduced-motion: reduce`** disables GSAP tweens, parallax, tilts, the hero
  spin *and* renders final states immediately (CSS + JS both covered).
- **Z-depth** — background orbs parallax slower than foreground panels; glass cards use
  layered diffused shadows (`0 20px 40px rgba(0,0,0,0.05)` stack).
- Isometric snapping on tool cards via `IsometricTilt` (perspective 900, transform-only).

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| `403 Missing or invalid CSRF token` from curl | CSRF protects mutations: first `GET /api/health` to receive the cookie, then send its value as the `X-CSRF-Token` header. |
| Frontend shows "API unreachable" | Is the backend running on :8000? Does `CORS_ORIGINS` in `backend/.env` include `http://localhost:3000`? |
| Comparative page: ortholog unavailable | Ensembl's legacy REST is degraded (healthy calls currently take 60–200 s). The first call may time out — retry; successes cache for 24 h. `ENSEMBL_TIMEOUT_S` tunes the window. |
| Variant scores partially unavailable | By design — each source degrades independently (timeouts, missing tables). The card shows the source's own detail. |
| Port conflicts | `--port` flag on uvicorn; change `NEXT_PUBLIC_API_BASE_URL` + `CORS_ORIGINS` to match. |
| `npm run build` CSP errors in dev | Dev-only CSP includes `'unsafe-eval'` for HMR; production CSP is strict — see `next.config.js`. |

## 9. Production notes & roadmap

- **Deploy:** `frontend` is `output: "standalone"` (see Next.js docs); `backend/` ships a
  `Dockerfile`. Put both behind TLS, set `CSRF_COOKIE_SECURE=true` and update the CSP
  `connect-src` (see SECURITY_AUDIT.md §8).
- **Agentic features (planned):** the `ANTHROPIC_API_KEY` / `PINECONE_API_KEY` hooks in
  `config.py` are reserved for an LLM-assistant lane (interpretation summaries over
  variant evidence) and a vector index of structure annotations.
- **Auth:** none yet — add OIDC/API tokens before public hosting.
