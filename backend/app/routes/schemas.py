"""Pydantic request models — the first line of input validation.

Every string the API accepts is constrained here by pattern/length BEFORE it
reaches parsers, caches, or URL construction. Fail-closed: anything that does
not match is a 422 with a safe message, never echoed back raw.
"""
from __future__ import annotations

import re

from pydantic import BaseModel, Field, field_validator

_SEQ_RE = re.compile(r"^[A-Z*\-_.]+$")
_MAX_SEQ = 2000


class PairwiseAlignmentRequest(BaseModel):
    sequence_a: str
    sequence_b: str
    match: int = Field(default=2, ge=1, le=5)
    mismatch: int = Field(default=-1, ge=-5, le=-1)
    gap: int = Field(default=-2, ge=-5, le=-1)

    @field_validator("sequence_a", "sequence_b")
    @classmethod
    def _clean_sequence(cls, v: str) -> str:
        if len(v) > _MAX_SEQ * 2:
            raise ValueError(f"Sequence too long (limit {_MAX_SEQ} residues).")
        cleaned = "".join(v.split()).upper()
        if len(cleaned) > _MAX_SEQ:
            raise ValueError(f"Sequence too long (limit {_MAX_SEQ} residues).")
        if not cleaned:
            raise ValueError("Sequence must not be empty.")
        if not _SEQ_RE.fullmatch(cleaned):
            raise ValueError("Sequence contains characters outside [A-Z * - _ .].")
        return cleaned


class VariantImpactRequest(BaseModel):
    uniprot_id: str = Field(pattern=r"^[A-Z0-9]{1,15}$")
    position: int = Field(ge=1, le=100000)
    ref: str = Field(pattern=r"^[A-Za-z]{1,3}$")
    alt: str = Field(pattern=r"^[A-Za-z]{1,3}$")

    @field_validator("ref", "alt")
    @classmethod
    def _upper(cls, v: str) -> str:
        return v.upper()
