"""Ensembl REST client — ortholog lookup (keyless).

Ensembl REST is rate-limited (bursts get HTTP 429 with Retry-After), so we
always send `Accept: application/json`, back off on 429 and transient 5xx,
and cache for 24 h.

Symbol-based Ensembl lookup is avoided wherever possible: "LIG1" resolves to
LRIG1 (a synonym collision), so callers pass the UniProt-curated Ensembl gene
ID and we use the ID-based /homology/id endpoint.
"""
from __future__ import annotations

import asyncio
import re

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=300)
_JSON_HEADERS = {"Accept": "application/json"}
_ENSG_RE = re.compile(r"^ENSG\d{11}$")


def _species_label(name: str) -> str:
    labels = {
        "balaenoptera_musculus": "Blue whale (Balaenoptera musculus)",
        "balaenoptera_acutorostrata": "Minke whale (Balaenoptera acutorostrata)",
        "physeter_catodon": "Sperm whale (Physeter catodon)",
    }
    return labels.get(name, name.replace("_", " ").title())


async def _get_json(
    client: httpx.AsyncClient, url: str, params: dict | None = None, retries: int = 3
) -> dict:
    for attempt in range(retries):
        resp = await client.get(url, params=params, headers=_JSON_HEADERS)
        # Ensembl REST is burst-sensitive: 429s carry Retry-After, and the
        # legacy hosts intermittently return 500s under load — back off on both.
        if resp.status_code in (429, 500, 502, 503) and attempt < retries - 1:
            await asyncio.sleep(1.5 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Ensembl REST unavailable after retries.")


async def find_ortholog(symbol: str, species: list[str], ensembl_gene: str | None = None) -> dict:
    """Best ortholog of a human gene among the candidate species (in order).

    Ensembl's symbol endpoint returns an entry for *every* gene carrying the
    symbol (primary or synonym) — for "LIG1" that means both DNA ligase 1 and
    LRIG1. When the UniProt-curated gene ID is available (ENSG…, validated by
    pattern) we keep only the matching entry before searching for whale
    orthologs; otherwise the first entry wins.
    """
    key = f"orth:{ensembl_gene or symbol}:{','.join(species)}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.ensembl_base_url}/homology/symbol/homo_sapiens/{symbol}"
    curated = ensembl_gene if (ensembl_gene and _ENSG_RE.fullmatch(ensembl_gene)) else None
    result: dict = {"available": False}
    async with httpx.AsyncClient(timeout=s.ensembl_timeout_s) as client:
        try:
            data = await _get_json(client, url, params={"type": "orthologues"})
        except Exception:
            # Never cache the failure — the upstream is burst-sensitive and a
            # cached miss would poison every request for the TTL window.
            result["detail"] = "Ensembl homology lookup failed."
            return result
        for org in data.get("data", []):
            if curated and org.get("id") != curated:
                continue  # symbol ambiguity — this entry is the wrong gene
            for hom in org.get("homologies", []) or []:
                target = hom.get("target", {})
                if target.get("species") in species:
                    protein_id = target.get("protein_id")
                    sequence = None
                    if protein_id:
                        seq_resp = await client.get(
                            f"{s.ensembl_base_url}/sequence/id/{protein_id}",
                            params={"type": "protein"},
                            headers={"Accept": "text/plain"},
                        )
                        if seq_resp.status_code == 200:
                            sequence = seq_resp.text.strip()
                    result = {
                        "available": True,
                        "species": target.get("species"),
                        "species_label": _species_label(target.get("species", "")),
                        "protein_id": protein_id,
                        "percent_identity": target.get("perc_id"),
                        "orthology_type": hom.get("type"),
                        "sequence": sequence,
                    }
                    break
            if result["available"]:
                break
    if result["available"]:
        _cache.set(key, result)
    return result
