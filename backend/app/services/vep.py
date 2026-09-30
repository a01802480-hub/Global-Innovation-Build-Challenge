"""Variant effect prediction via Ensembl VEP REST (keyless) — SIFT + PolyPhen.

VEP computes SIFT and PolyPhen scores per transcript for protein HGVS input.
We resolve the canonical Ensembl protein ID (ENSP) via /lookup on the
UniProt-curated Ensembl gene ID when available (Ensembl's own symbol lookup
for "LIG1" resolves to LRIG1 — a synonym collision), then POST the
substitution as `ENSP:p.Ref123Alt` to /vep/human/hgvs.
"""
from __future__ import annotations

import asyncio
import re

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=500)
_ENSG_RE = re.compile(r"^ENSG\d{11}$")
_AA3 = {
    "A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys", "Q": "Gln",
    "E": "Glu", "G": "Gly", "H": "His", "I": "Ile", "L": "Leu", "K": "Lys",
    "M": "Met", "F": "Phe", "P": "Pro", "S": "Ser", "T": "Thr", "W": "Trp",
    "Y": "Tyr", "V": "Val",
}


async def _canonical_ensp(symbol: str, ensembl_gene: str | None = None) -> str | None:
    """Canonical human ENSP for a gene.

    Prefer the UniProt-curated ENSG (validated by pattern before entering a
    URL); fall back to Ensembl's own symbol lookup. Transient 429/5xx get a
    short backoff; failures are never cached (the upstream is flaky, and a
    cached None would poison every later request for a day).
    """
    key = f"ensp:{ensembl_gene or symbol}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    if ensembl_gene and _ENSG_RE.fullmatch(ensembl_gene):
        url = f"{s.ensembl_base_url}/lookup/id/{ensembl_gene}"
    else:
        url = f"{s.ensembl_base_url}/lookup/symbol/homo_sapiens/{symbol}"
    ensp: str | None = None
    async with httpx.AsyncClient(timeout=s.ensembl_timeout_s) as client:
        for attempt in range(3):
            try:
                resp = await client.get(url, params={"expand": 1}, headers={"Accept": "application/json"})
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                break  # transport errors (timeouts, resets) — give up gracefully
            if resp.status_code in (429, 500, 502, 503) and attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            if resp.status_code != 200:
                break
            try:
                data = resp.json()
            except ValueError:
                break  # upstream served non-JSON — treat as unavailable
            ensp = (data.get("Translation") or {}).get("id") or None
            if ensp is None:
                # Fall back to the canonical transcript's translation.
                canonical = data.get("canonical_transcript") or ""
                detail = await client.get(
                    f"{s.ensembl_base_url}/lookup/id/{canonical}",
                    params={"expand": 1},
                    headers={"Accept": "application/json"},
                )
                if detail.status_code == 200:
                    try:
                        ensp = (detail.json().get("Translation") or {}).get("id") or None
                    except ValueError:
                        ensp = None
            break
        if ensp is None:
            ensp = await _ensp_from_homology(client, symbol, ensembl_gene)
    if ensp:
        _cache.set(key, ensp)
    return ensp


async def _ensp_from_homology(
    client: httpx.AsyncClient, symbol: str, ensembl_gene: str | None
) -> str | None:
    """Fallback ENSP resolution: the homology response carries `source.protein_id`.

    Used when /lookup is flaky (the legacy Ensembl hosts intermittently 5xx).
    The response may contain several genes sharing the symbol — when the
    curated ENSG is known, only the matching entry is consulted.
    """
    s = get_settings()
    url = f"{s.ensembl_base_url}/homology/symbol/homo_sapiens/{symbol}"
    try:
        resp = await client.get(url, params={"type": "orthologues"}, headers={"Accept": "application/json"})
        if resp.status_code != 200:
            return None
        data = resp.json()
    except (httpx.HTTPError, ValueError):
        return None
    for org in data.get("data", []) or []:
        if ensembl_gene and _ENSG_RE.fullmatch(ensembl_gene) and org.get("id") != ensembl_gene:
            continue
        for hom in org.get("homologies", []) or []:
            pid = (hom.get("source") or {}).get("protein_id")
            if pid and isinstance(pid, str) and pid.startswith("ENSP"):
                return pid
    return None


async def predict(
    symbol: str, position: int, ref: str, alt: str, ensembl_gene: str | None = None
) -> dict:
    if not symbol and not ensembl_gene:
        return {"status": "unavailable", "detail": "No gene mapping to resolve an Ensembl protein ID."}
    ensp = await _canonical_ensp(symbol, ensembl_gene)
    if not ensp:
        return {"status": "unavailable", "detail": "No Ensembl protein mapping for this gene."}
    hgvs = f"{ensp}:p.{_AA3[ref]}{position}{_AA3[alt]}"
    s = get_settings()
    async with httpx.AsyncClient(timeout=s.ensembl_timeout_s) as client:
        rows: list = []
        for attempt in range(3):
            try:
                resp = await client.post(
                    f"{s.ensembl_base_url}/vep/human/hgvs",
                    json={"hgvs_notations": [hgvs]},
                    headers={"Content-Type": "application/json", "Accept": "application/json"},
                )
            except httpx.HTTPError:
                if attempt < 2:
                    await asyncio.sleep(1.5 * (attempt + 1))
                    continue
                return {"status": "unavailable", "detail": "VEP upstream timeout (transport error)."}
            if resp.status_code in (429, 500, 502, 503) and attempt < 2:
                await asyncio.sleep(1.5 * (attempt + 1))
                continue
            if resp.status_code != 200:
                return {"status": "unavailable", "detail": f"VEP upstream error (HTTP {resp.status_code})."}
            try:
                rows = resp.json()
            except ValueError:
                return {"status": "unavailable", "detail": "VEP returned a non-JSON response."}
            break
    if not rows:
        return {"status": "unavailable", "detail": "VEP returned no result."}
    sift: dict | None = None
    polyphen: dict | None = None
    for tc in rows[0].get("transcript_consequences", []) or []:
        if sift is None and tc.get("sift_score") is not None:
            sift = {"score": tc["sift_score"], "prediction": tc.get("sift_prediction")}
        if polyphen is None and tc.get("polyphen_score") is not None:
            polyphen = {"score": tc["polyphen_score"], "prediction": tc.get("polyphen_prediction")}
    if sift is None and polyphen is None:
        return {"status": "unavailable", "detail": "No SIFT/PolyPhen consequence for this substitution."}
    return {"status": "ok", "hgvs": hgvs, "sift": sift, "polyphen": polyphen}
