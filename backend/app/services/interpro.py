"""InterPro domain annotations for a UniProt protein (EBI Proteins API, keyless)."""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings

_cache = TTLCache(ttl_s=86400, max_entries=300)


async def fetch_domains(accession: str) -> list[dict]:
    cached = _cache.get(accession)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.interpro_base_url}/protein/reviewed/{accession}/"
    params = {"page_size": 200}
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    domains: list[dict] = []
    seen: set[tuple[str, int, int]] = set()
    for item in data.get("results", []) or []:
        for entry in item.get("entries", []) or []:
            acc = entry.get("accession")
            name = entry.get("name")
            etype = entry.get("entry_type")
            for loc in entry.get("entry_protein_locations", []) or []:
                for frag in loc.get("fragments", []) or []:
                    start, end = frag.get("start"), frag.get("end")
                    if acc and start is not None and end is not None and (acc, start, end) not in seen:
                        seen.add((acc, start, end))
                        domains.append(
                            {"accession": acc, "name": name, "type": etype, "start": start, "end": end}
                        )
    _cache.set(accession, domains)
    return domains
