"""AlphaMissense per-residue predictions (hegelab hotspotapi, keyless).

The public hotspotapi returns, per (UniProt id, residue) pair, the lists of
substitutions classified pathogenic / ambiguous / benign plus the mean
pathogenicity score. Response shape (verified live):

    {"uid":"P18858","aa":"R","resi":641,"benign":"","ambiguous":"",
     "pathogenic":"6:C,G,H,L,P,S","mean":0.9755,...}
"""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=500)


def _class_for(row: dict, alt: str) -> str | None:
    for label in ("pathogenic", "ambiguous", "benign"):
        entries = row.get(label) or ""
        for token in entries.split(","):
            letters = token.split(":", 1)[-1]
            if alt in letters.split(","):
                return label
    return None


async def predict(uniprot_id: str, position: int, ref: str, alt: str) -> dict:
    key = f"{uniprot_id}:{position}"
    cached = _cache.get(key)
    if cached is not None:
        row = cached
    else:
        s = get_settings()
        async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
            resp = await client.get(
                f"{s.alphamissense_base_url}/hotspotapi",
                params={"uid": uniprot_id, "resi": position},
            )
            if resp.status_code == 404:
                return {"status": "unavailable", "detail": "Position not in the AlphaMissense table."}
            resp.raise_for_status()
            row = resp.json()
        _cache.set(key, row)
    if row.get("aa") and row["aa"] != ref:
        return {
            "status": "unavailable",
            "detail": f"Reference residue mismatch (AlphaMissense table has {row.get('aa')}).",
        }
    am_class = _class_for(row, alt)
    if am_class is None:
        return {
            "status": "ok",
            "class": "not_listed",
            "detail": "Substitution not present in the AlphaMissense table for this position.",
            "mean_pathogenicity": row.get("mean"),
        }
    return {
        "status": "ok",
        "class": am_class,
        "mean_pathogenicity": row.get("mean"),
        "reference": row.get("aa"),
    }
