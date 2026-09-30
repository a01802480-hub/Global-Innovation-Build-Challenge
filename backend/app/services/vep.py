"""Variant effect prediction via Ensembl VEP REST (keyless) — SIFT + PolyPhen.

VEP computes SIFT and PolyPhen scores per transcript for protein HGVS input.
We resolve the canonical Ensembl protein ID (ENSP) for a gene symbol through
the homology endpoint (its `source.protein_id` — verified live), then POST
the substitution as `ENSP:p.Ref123Alt` to /vep/human/hgvs.
"""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=500)
_AA3 = {
    "A": "Ala", "R": "Arg", "N": "Asn", "D": "Asp", "C": "Cys", "Q": "Gln",
    "E": "Glu", "G": "Gly", "H": "His", "I": "Ile", "L": "Leu", "K": "Lys",
    "M": "Met", "F": "Phe", "P": "Pro", "S": "Ser", "T": "Thr", "W": "Trp",
    "Y": "Tyr", "V": "Val",
}


async def _canonical_ensp(symbol: str) -> str | None:
    """Canonical human ENSP for a gene symbol via the homology endpoint."""
    key = f"ensp:{symbol}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.ensembl_base_url}/homology/symbol/homo_sapiens/{symbol}"
    ensp: str | None = None
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(url, params={"type": "orthologues"}, headers={"Accept": "application/json"})
        if resp.status_code == 200:
            for org in resp.json().get("data", []):
                for hom in org.get("homologies", []) or []:
                    if hom.get("target", {}).get("species") == "homo_sapiens":
                        ensp = (hom.get("source") or {}).get("protein_id")
                        break
                if ensp:
                    break
    _cache.set(key, ensp)
    return ensp


async def predict(symbol: str, position: int, ref: str, alt: str) -> dict:
    if not symbol:
        return {"status": "unavailable", "detail": "No gene symbol to resolve an Ensembl protein ID."}
    ensp = await _canonical_ensp(symbol)
    if not ensp:
        return {"status": "unavailable", "detail": "No Ensembl protein mapping for this gene."}
    hgvs = f"{ensp}:p.{_AA3[ref]}{position}{_AA3[alt]}"
    s = get_settings()
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.post(
            f"{s.ensembl_base_url}/vep/human/hgvs",
            json={"hgvs_notations": [hgvs]},
            headers={"Content-Type": "application/json", "Accept": "application/json"},
        )
        resp.raise_for_status()
        rows = resp.json()
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
