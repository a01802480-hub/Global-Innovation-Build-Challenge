"""UniProtKB REST client (server-side; keyless public endpoint)."""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings

_FIELDS = "accession,gene_names,protein_name,organism_name,length,sequence,xref_ensembl"
_cache = TTLCache(ttl_s=3600, max_entries=300)


def _map_entry(data: dict) -> dict:
    genes = data.get("genes") or []
    description = data.get("proteinDescription") or data.get("proteinName") or {}
    recommended = description.get("recommendedName") or {}
    # Ensembl gene ID from cross-references. Ensembl's own symbol lookup for
    # "LIG1" resolves to LRIG1 (a synonym collision) — the UniProt-curated
    # xref is authoritative and lets us call the ID-based homology endpoint.
    # Note the xref's `id` is the transcript (ENST); the gene ID (ENSG) is in
    # the xref properties, version-suffixed (e.g. "ENSG00000105486.16").
    xrefs = data.get("uniProtKBCrossReferences") or []
    ensembl_gene: str | None = None
    for xref in xrefs:
        if xref.get("database") != "Ensembl":
            continue
        for prop in xref.get("properties") or []:
            if prop.get("key") == "GeneId":
                gene_id = str(prop.get("value", "")).split(".")[0]
                if gene_id.startswith("ENSG"):
                    ensembl_gene = gene_id
                    break
        if ensembl_gene:
            break
    return {
        "accession": data.get("primaryAccession"),
        "gene": next((g.get("geneName", {}).get("value") for g in genes), None),
        "name": recommended.get("fullName", {}).get("value")
        or description.get("fullName", {}).get("value"),
        "organism": (data.get("organism") or {}).get("scientificName"),
        "length": (data.get("sequence") or {}).get("length"),
        "sequence": (data.get("sequence") or {}).get("value"),
        "ensembl_gene": ensembl_gene,
    }


async def fetch_entry(accession: str) -> dict:
    """Fetch a curated UniProtKB entry by accession."""
    cached = _cache.get(accession)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.uniprot_base_url}/uniprotkb/{accession}"
    params = {"fields": _FIELDS}
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(url, params=params)
        if resp.status_code == 400:
            raise ValueError(f"Unknown or malformed UniProt accession: {accession}")
        resp.raise_for_status()
        entry = _map_entry(resp.json())
    _cache.set(accession, entry)
    return entry


async def fetch_by_symbol(symbol: str, organism: str = "9606") -> dict:
    """First reviewed entry for a gene symbol in the given organism (default human)."""
    key = f"sym:{symbol}:{organism}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    s = get_settings()
    url = f"{s.uniprot_base_url}/uniprotkb/search"
    params = {
        "query": f'gene_exact:"{symbol}" AND reviewed:true AND organism_id:"{organism}"',
        "fields": _FIELDS,
        "size": 5,
    }
    async with httpx.AsyncClient(timeout=s.request_timeout_s) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        results = resp.json().get("results", [])
    if not results:
        raise ValueError(f"No reviewed UniProt entry found for gene {symbol} (organism {organism}).")
    # gene_exact also matches synonyms (e.g. LRIG1's synonym "LIG1"), so prefer
    # the entry whose *primary* gene name equals the requested symbol exactly.
    entry = _map_entry(
        next(
            (
                r
                for r in results
                if any((g.get("geneName") or {}).get("value") == symbol for g in r.get("genes", []) or [])
            ),
            results[0],
        )
    )
    _cache.set(key, entry)
    return entry
