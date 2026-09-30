"""Comparative genomics dashboard endpoint.

Aggregates, for one gene (e.g. LIG1 or PNKP from the blue-whale BER pathway):
- the reviewed human UniProtKB entry,
- the best available whale ortholog from Ensembl (blue whale first),
- InterPro domain architecture of the human protein.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Path

from ..config import get_settings
from ..services import ensembl, interpro, uniprot

router = APIRouter(tags=["comparative"])


@router.get("/comparative/gene/{symbol}")
async def gene_dashboard(symbol: str = Path(pattern=r"^[A-Za-z0-9]{1,20}$")) -> dict:
    gene = symbol.upper()
    try:
        human = await uniprot.fetch_by_symbol(gene)
        ortholog = await ensembl.find_ortholog(
            gene, get_settings().ortholog_species_list, ensembl_gene=human.get("ensembl_gene")
        )
        domains = await interpro.fetch_domains(human["accession"])
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Upstream error: {exc}")
    return {"gene": gene, "human": human, "ortholog": ortholog, "domains": domains}
