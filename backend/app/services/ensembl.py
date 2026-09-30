"""Ensembl REST client — ortholog lookup (keyless).

Ensembl REST is rate-limited (bursts get HTTP 429 with Retry-After), so we
always send `Accept: application/json`, back off on 429, and cache for 24 h.
"""
from __future__ import annotations

import asyncio

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=300)
_JSON_HEADERS = {"Accept": "application/json"}


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
        if resp.status_code == 429 and attempt < retries - 1:
            await asyncio.sleep(1.5 * (attempt + 1))
            continue
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError("Ensembl rate limit exceeded.")


async def find_ortholog(symbol: str, species: list[str]) -> dict:
    """Best ortholog of a human gene among the candidate species (in order)."""
    key = f"orth:{symbol}:{','.join(species)}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.ensembl_base_url}/homology/symbol/homo_sapiens/{symbol}"
    result: dict = {"available": False}
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        try:
            data = await _get_json(client, url, params={"type": "orthologues"})
        except Exception:
            result["detail"] = "Ensembl homology lookup failed."
            _cache.set(key, result)
            return result
        for org in data.get("data", []):
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
    _cache.set(key, result)
    return result
