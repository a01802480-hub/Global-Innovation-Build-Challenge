"""Strict, fail-closed parsers for FASTA text and PDB coordinate files.

Security rules implemented here (see README "Security Audit" section):
- Fixed-width column slicing only — the PDB grammar is positional, not regex-based.
- Every numeric field goes through a bounded int()/float() inside try/except;
  malformed records are skipped, never guessed.
- FASTA uses a character whitelist; anything unexpected raises ParseError.
- Hard size caps are enforced before any parsing work happens.
"""
from __future__ import annotations

import math
import re
from dataclasses import dataclass, field

_MAX_FASTA_BYTES = 2_000_000
_MAX_SEQ_LEN = 20_000
_MAX_PDB_BYTES = 25_000_000
_MAX_ATOMS = 300_000
_FASTA_HEADER_RE = re.compile(r"^>[^\r\n]*$")
_SEQ_CHARS = set("ABCDEFGHIKLMNPQRSTVWXYZUO*-_.")
_METAL_ELEMENTS = {"MG", "ZN", "MN", "FE", "CU", "K", "NA", "CA", "NI", "CO"}


class ParseError(ValueError):
    """Raised on any input that fails validation. Messages are safe to show."""


@dataclass(frozen=True)
class FastaRecord:
    header: str
    sequence: str


@dataclass(frozen=True)
class ResiduePoint:
    resname: str
    chain: str
    resseq: int
    x: float
    y: float
    z: float
    bfactor: float = 0.0  # carries pLDDT in AlphaFold model files


@dataclass(frozen=True)
class MetalSite:
    element: str
    resname: str
    chain: str
    resseq: int
    x: float
    y: float
    z: float


@dataclass
class ActiveSite:
    site_id: str
    residues: list[tuple[str, str, int]] = field(default_factory=list)  # (resname, chain, resseq)


@dataclass
class ParsedPdb:
    title: str = ""
    chains: list[str] = field(default_factory=list)
    points: list[ResiduePoint] = field(default_factory=list)
    metals: list[MetalSite] = field(default_factory=list)
    sites: list[ActiveSite] = field(default_factory=list)


def parse_fasta(text: str) -> list[FastaRecord]:
    """Parse FASTA text into records. Raises ParseError on anything suspicious."""
    if len(text.encode("utf-8", errors="ignore")) > _MAX_FASTA_BYTES:
        raise ParseError("FASTA input too large (limit 2 MB).")
    records: list[FastaRecord] = []
    header: str | None = None
    parts: list[str] = []
    total = 0

    def flush() -> None:
        nonlocal header
        if header is not None:
            records.append(FastaRecord(header, "".join(parts)))
        parts.clear()

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if line.startswith(">"):
            if not _FASTA_HEADER_RE.match(line):
                raise ParseError("Malformed FASTA header line.")
            flush()
            header = line[1:].strip()[:200]
            continue
        if header is None:
            raise ParseError("Sequence data found before any '>' header.")
        compact = "".join(line.split()).upper()
        bad = next((c for c in compact if c not in _SEQ_CHARS), None)
        if bad is not None:
            raise ParseError(f"Invalid character in sequence: {bad!r}. Allowed: letters, * - _ .")
        total += len(compact)
        if total > _MAX_SEQ_LEN:
            raise ParseError(f"Sequence too long (limit {_MAX_SEQ_LEN} residues).")
        parts.append(compact)
    flush()
    if not records:
        raise ParseError("No FASTA records found.")
    return records


def parse_fasta_single(text: str) -> FastaRecord:
    records = parse_fasta(text)
    if len(records) != 1:
        raise ParseError(f"Expected exactly one FASTA record, got {len(records)}.")
    return records[0]


def parse_pdb_text(text: str) -> ParsedPdb:
    """Extract Cα atoms, HETATM metals, SITE records and title from PDB text."""
    if len(text.encode("utf-8", errors="ignore")) > _MAX_PDB_BYTES:
        raise ParseError("PDB file too large (limit 25 MB).")
    result = ParsedPdb()
    ca: dict[tuple[str, int], ResiduePoint] = {}
    for line in text.splitlines():
        if not line:
            continue
        record = line[:6].strip()
        # TITLE and SITE records are typically shorter than 54 columns — handle
        # them before the fixed-width gate below.
        if record == "TITLE" and not result.title:
            result.title = " ".join(line[10:].split())[:200]
            continue
        if record == "SITE":
            site = _parse_site_line(line)
            if site is not None:
                result.sites.append(site)
            continue
        if record not in {"ATOM", "HETATM"} or len(line) < 54:
            continue
        element = line[76:78].strip().upper() or _element_guess(line[12:16].strip())
        try:
            x = float(line[30:38])
            y = float(line[38:46])
            z = float(line[46:54])
            bfac = float(line[60:66])
            resseq = int(line[22:26])
        except ValueError:
            continue  # malformed numeric field — skip the record, never guess
        if not all(math.isfinite(v) for v in (x, y, z, bfac)):
            continue
        chain = line[21:22].strip() or "A"
        resname = line[17:20].strip()
        if record == "ATOM" and line[12:16].strip() == "CA":
            key = (chain, resseq)
            if key not in ca:
                ca[key] = ResiduePoint(resname, chain, resseq, x, y, z, bfac)
                if len(ca) > _MAX_ATOMS:
                    raise ParseError("Too many atoms (limit exceeded).")
        elif record == "HETATM" and element in _METAL_ELEMENTS:
            result.metals.append(MetalSite(element, resname, chain, resseq, x, y, z))
    result.points = [ca[k] for k in sorted(ca)]
    result.chains = sorted({p.chain for p in result.points})
    return result


def _element_guess(atom_name: str) -> str:
    """HETATM element column is unreliable in some legacy files; guess from atom name."""
    name = atom_name.upper()
    two = name[:2]
    if two in _METAL_ELEMENTS:
        return two
    one = name[:1]
    return one if one in _METAL_ELEMENTS else ""


def _parse_site_line(line: str) -> ActiveSite | None:
    """Parse a SITE record: up to 4 residues per line, 12-column group stride."""
    site_id = line[11:15].strip()
    if not site_id:
        return None
    residues: list[tuple[str, str, int]] = []
    for off in (0, 12, 24, 36):
        resname = line[18 + off : 21 + off].strip()
        chain = line[22 + off : 23 + off].strip() or "A"
        seq_s = line[23 + off : 27 + off].strip()
        if not resname or not seq_s:
            continue
        try:
            seq = int(seq_s)
        except ValueError:
            continue
        residues.append((resname, chain, seq))
    if not residues:
        return None
    return ActiveSite(site_id, residues)
