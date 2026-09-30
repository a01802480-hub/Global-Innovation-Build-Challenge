"""Pairwise sequence alignment endpoint."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from ..align import AlignmentError, needleman_wunsch
from .schemas import PairwiseAlignmentRequest

router = APIRouter(tags=["alignment"])


@router.post("/alignment/pairwise")
async def pairwise(req: PairwiseAlignmentRequest) -> dict:
    try:
        aln = needleman_wunsch(req.sequence_a, req.sequence_b, req.match, req.mismatch, req.gap)
    except AlignmentError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    return {
        "aligned_a": aln.aligned_a,
        "aligned_b": aln.aligned_b,
        "score": aln.score,
        "identity_pct": aln.identity_pct,
        "matches": aln.matches,
        "mismatches": aln.mismatches,
        "gaps": aln.gaps,
        "length": aln.length,
    }
