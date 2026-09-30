"""InterPro domain annotations for a UniProt protein (EBI Proteins API, keyless).

Response shape of /entry/interpro/protein/reviewed/{acc}/ (verified live):

    {"count": N, "results": [
        {"metadata": {"accession", "name", "type", ...},   # the InterPro entry
         "proteins": [{"entry_protein_locations": [{"fragments": [{"start", "end"}]}]}]}
    ]}
"""
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
    # /entry/interpro/protein/reviewed/ returns the protein's InterPro entry
    # annotations ({"count": N, "results": [...]}) — the bare /protein/ path
    # returns protein metadata, not domain entries.
    url = f"{s.interpro_base_url}/entry/interpro/protein/reviewed/{accession}/"
    params = {"page_size": 200}
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()
    domains: list[dict] = []
    seen: set[tuple[str, int, int]] = set()
    for item in data.get("results", []) or []:
        meta = item.get("metadata") or {}
        acc = meta.get("accession")
        name = meta.get("name")
        etype = meta.get("type")
        for prot in item.get("proteins", []) or []:
            for loc in prot.get("entry_protein_locations", []) or []:
                for frag in loc.get("fragments", []) or []:
                    start, end = frag.get("start"), frag.get("end")
                    if acc and start is not None and end is not None and (acc, start, end) not in seen:
                        seen.add((acc, start, end))
                        domains.append(
                            {"accession": acc, "name": name, "type": etype, "start": start, "end": end}
                        )
    _cache.set(accession, domains)
    return domains
