"""Pairwise global alignment — Needleman–Wunsch in pure Python.

Memory-safe: score matrix rows are compact `array('i')` (4 bytes/cell), and
sequences are capped at 1500 residues each, so worst-case memory stays ~9 MB.
No Biopython dependency required.
"""
from __future__ import annotations

from array import array
from dataclasses import dataclass

MAX_ALIGN_LEN = 1500


@dataclass(frozen=True)
class Alignment:
    aligned_a: str
    aligned_b: str
    score: int
    identity_pct: float
    matches: int
    mismatches: int
    gaps: int
    length: int


class AlignmentError(ValueError):
    pass


def needleman_wunsch(
    a: str, b: str, match: int = 2, mismatch: int = -1, gap: int = -2
) -> Alignment:
    if not a or not b:
        raise AlignmentError("Both sequences must be non-empty.")
    if len(a) > MAX_ALIGN_LEN or len(b) > MAX_ALIGN_LEN:
        raise AlignmentError(
            f"Sequences over {MAX_ALIGN_LEN} residues are not supported for pairwise alignment."
        )
    n, m = len(a), len(b)
    rows = [array("i", [0]) * (m + 1) for _ in range(n + 1)]
    for j in range(1, m + 1):
        rows[0][j] = j * gap
    for i in range(1, n + 1):
        rows[i][0] = i * gap
        prev, row, ai = rows[i - 1], rows[i], a[i - 1]
        for j in range(1, m + 1):
            diag = prev[j - 1] + (match if ai == b[j - 1] else mismatch)
            up = prev[j] + gap
            left = row[j - 1] + gap
            row[j] = diag if diag >= up and diag >= left else (up if up >= left else left)

    # Traceback — prefer diagonal on ties (fewer spurious indels).
    i, j = n, m
    aa: list[str] = []
    bb: list[str] = []
    while i > 0 or j > 0:
        if (
            i > 0
            and j > 0
            and rows[i][j] == rows[i - 1][j - 1] + (match if a[i - 1] == b[j - 1] else mismatch)
        ):
            aa.append(a[i - 1])
            bb.append(b[j - 1])
            i -= 1
            j -= 1
        elif i > 0 and rows[i][j] == rows[i - 1][j] + gap:
            aa.append(a[i - 1])
            bb.append("-")
            i -= 1
        else:
            aa.append("-")
            bb.append(b[j - 1])
            j -= 1
    aa.reverse()
    bb.reverse()
    aligned_a, aligned_b = "".join(aa), "".join(bb)
    matches = sum(1 for x, y in zip(aligned_a, aligned_b) if x == y and x != "-")
    mismatches = sum(1 for x, y in zip(aligned_a, aligned_b) if x != y and x != "-" and y != "-")
    gaps = sum(1 for x, y in zip(aligned_a, aligned_b) if x == "-" or y == "-")
    identity_pct = round(100.0 * matches / max(1, matches + mismatches), 2)
    return Alignment(aligned_a, aligned_b, rows[n][m], identity_pct, matches, mismatches, gaps, len(aligned_a))
