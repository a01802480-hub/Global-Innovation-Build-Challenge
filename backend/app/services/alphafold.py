"""AlphaFold DB client — model metadata + PDB download (keyless).

AlphaFold model PDB files store per-residue pLDDT in the B-factor column;
the strict PDB parser picks those up as `bfactor`.
"""
from __future__ import annotations

import httpx

from ..cache import TTLCache
from ..config import get_settings
from ..parsers import ParseError, parse_pdb_text

_cache = TTLCache(ttl_s=86400, max_entries=100)


async def fetch_model(uniprot_id: str) -> dict:
    """Download the AlphaFold model for a UniProt accession; return Cα trace + pLDDT."""
    cached = _cache.get(uniprot_id)
    if cached is not None:
        return cached
    s = get_settings()
    async with httpx.AsyncClient(timeout=90.0) as client:
        meta_resp = await client.get(f"{s.alphafold_base_url}/prediction/{uniprot_id}")
        if meta_resp.status_code == 404:
            raise ValueError(f"No AlphaFold model available for {uniprot_id}.")
        meta_resp.raise_for_status()
        meta = meta_resp.json()
        if not meta:
            raise ValueError(f"No AlphaFold model available for {uniprot_id}.")
        pdb_url = meta[0].get("pdbUrl")
        if not pdb_url:
            raise ValueError("AlphaFold metadata missing the model URL.")
        resp = await client.get(pdb_url)
        resp.raise_for_status()
        parsed = parse_pdb_text(resp.text)
    if not parsed.points:
        raise ParseError("AlphaFold model contained no Cα atoms.")
    model = {
        "source": "alphafold",
        "uniprot": uniprot_id,
        "points": [
            {
                "resn": p.resname,
                "resi": p.resseq,
                "chain": p.chain,
                "x": p.x,
                "y": p.y,
                "z": p.z,
                "plddt": p.bfactor,
            }
            for p in parsed.points
        ],
        "mean_plddt": round(sum(p.bfactor for p in parsed.points) / len(parsed.points), 2),
    }
    _cache.set(uniprot_id, model)
    return model
