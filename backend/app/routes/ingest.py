"""Data-ingestion routes: UniProtKB, Ensembl orthologs, InterPro domains.

All path/query identifiers are regex-validated before they are used in any
upstream URL, so path traversal and URL injection are impossible by
construction (see the Security Audit in README.md).
"""
from __future__ import annotations

import re

from fastapi import APIRouter, HTTPException, Path, Query

from ..config import get_settings
from ..services import ensembl, interpro, uniprot

router = APIRouter(tags=["ingest"])

_GENE_RE = re.compile(r"^[A-Za-z0-9]{1,20}$")
_SPECIES_RE = re.compile(r"^[a-z_]{3,40}$")


@router.get("/ingest/uniprot/{accession}")
async def uniprot_entry(accession: str = Path(pattern=r"^[A-Z0-9]{1,20}$")) -> dict:
    try:
        return await uniprot.fetch_entry(accession)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"UniProtKB upstream error: {exc}")


@router.get("/ingest/ensembl/orthologs")
async def ensembl_orthologs(
    gene: str = Query(pattern=r"^[A-Za-z0-9]{1,20}$"),
    species: str | None = Query(default=None, pattern=r"^[a-z_]{3,40}$"),
) -> dict:
    candidates = [species] if species else get_settings().ortholog_species_list
    result = await ensembl.find_ortholog(gene.upper(), candidates)
    return {"gene": gene.upper(), "ortholog": result}


@router.get("/ingest/interpro/{accession}")
async def interpro_domains(accession: str = Path(pattern=r"^[A-Z0-9]{1,20}$")) -> dict:
    try:
        domains = await interpro.fetch_domains(accession)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"InterPro upstream error: {exc}")
    return {"accession": accession, "domains": domains}
