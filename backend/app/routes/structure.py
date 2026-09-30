"""Structure endpoints: RCSB PDB models, AlphaFold models, backbone writhe.

The R3F viewer consumes a ~160-point Cα trace of the primary chain together
with per-residue local writhe, active-site residues (from SITE records) and
metal ions (from HETATM records).
"""
from __future__ import annotations

from collections import Counter

import httpx
from fastapi import APIRouter, HTTPException, Path

from ..cache import TTLCache
from ..config import get_settings
from ..parsers import ParsedPdb, ParseError, parse_pdb_text
from ..services import alphafold
from ..writhe import downsample, local_writhe, writhe

router = APIRouter(tags=["structure"])

_cache = TTLCache(ttl_s=86400, max_entries=100)
_MAX_TRACE_POINTS = 160

CATALOG = [
    {
        "id": "lig1",
        "pdb": "1X9N",
        "title": "Human DNA ligase I — catalytic core",
        "note": "Base-excision-repair junction enzyme (challenge target). Backbone writhe + active-site geometry.",
    },
    {
        "id": "rubisco",
        "pdb": "8RUC",
        "title": "RuBisCO (spinach) — activated",
        "note": "Ribulose-1,5-bisphosphate carboxylase/oxygenase. Catalytic Mg²⁺ site and carbamylated lysine.",
    },
]


@router.get("/structure/catalog")
async def catalog() -> dict:
    return {"entries": CATALOG}


@router.get("/structure/rcsb/{pdb_id}")
async def rcsb_model(pdb_id: str = Path(pattern=r"^[0-9A-Za-z]{4}$")) -> dict:
    key = f"rcsb:{pdb_id.upper()}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    async with httpx.AsyncClient(timeout=90.0) as client:
        resp = await client.get(f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb")
        if resp.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Unknown PDB ID: {pdb_id.upper()}")
        resp.raise_for_status()
        try:
            parsed = parse_pdb_text(resp.text)
        except ParseError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
    model = _finalize(parsed, source="rcsb", pdb_id=pdb_id.upper())
    _cache.set(key, model)
    return model


@router.get("/structure/alphafold/{uniprot}")
async def alphafold_model(uniprot: str = Path(pattern=r"^[A-Z0-9]{1,20}$")) -> dict:
    key = f"af:{uniprot}"
    cached = _cache.get(key)
    if cached is not None:
        return cached
    try:
        raw = await alphafold.fetch_model(uniprot)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ParseError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AlphaFold upstream error: {exc}")
    model = _finalize_from_dicts(raw["points"], source="alphafold", uniprot=uniprot, title=f"AlphaFold model — {uniprot}")
    model["mean_plddt"] = raw["mean_plddt"]
    _cache.set(key, model)
    return model


def _finalize(parsed: ParsedPdb, source: str, pdb_id: str | None = None, title: str | None = None) -> dict:
    if not parsed.points:
        raise HTTPException(status_code=404, detail="No Cα atoms found in this structure.")
    primary_chain = Counter(p.chain for p in parsed.points).most_common(1)[0][0]
    strided = downsample([p for p in parsed.points if p.chain == primary_chain], _MAX_TRACE_POINTS)
    coords = [(p.x, p.y, p.z) for p in strided]
    return {
        "source": source,
        "pdb_id": pdb_id,
        "title": title or parsed.title,
        "chains": parsed.chains,
        "primary_chain": primary_chain,
        "residue_count": len(strided),
        "full_residue_count": len(parsed.points),
        "points": [
            {
                "resn": p.resname,
                "resi": p.resseq,
                "chain": p.chain,
                "x": round(p.x, 3),
                "y": round(p.y, 3),
                "z": round(p.z, 3),
                "plddt": p.bfactor if p.bfactor > 0 else None,
            }
            for p in strided
        ],
        "writhe": round(writhe(coords), 4),
        "local_writhe": [round(v, 4) for v in local_writhe(coords)],
        "active_sites": _active_sites(parsed, primary_chain),
        "metals": [
            {"element": m.element, "resi": m.resseq, "chain": m.chain, "x": m.x, "y": m.y, "z": m.z}
            for m in parsed.metals
        ],
    }


def _finalize_from_dicts(points: list[dict], source: str, uniprot: str, title: str) -> dict:
    strided = downsample(points, _MAX_TRACE_POINTS)
    coords = [(p["x"], p["y"], p["z"]) for p in strided]
    return {
        "source": source,
        "pdb_id": None,
        "uniprot": uniprot,
        "title": title,
        "chains": sorted({p["chain"] for p in points}),
        "primary_chain": strided[0]["chain"] if strided else "A",
        "residue_count": len(strided),
        "full_residue_count": len(points),
        "points": [
            {
                "resn": p["resn"],
                "resi": p["resi"],
                "chain": p["chain"],
                "x": round(p["x"], 3),
                "y": round(p["y"], 3),
                "z": round(p["z"], 3),
                "plddt": p.get("plddt"),
            }
            for p in strided
        ],
        "writhe": round(writhe(coords), 4),
        "local_writhe": [round(v, 4) for v in local_writhe(coords)],
        "active_sites": [],
        "metals": [],
    }


def _active_sites(parsed: ParsedPdb, primary_chain: str) -> list[dict]:
    sites = []
    for site in parsed.sites:
        residues = [
            {"resname": r, "chain": c, "resi": s}
            for (r, c, s) in site.residues
            if c == primary_chain
        ]
        if residues:
            sites.append({"site_id": site.site_id, "residues": residues})
    return sites[:8]
