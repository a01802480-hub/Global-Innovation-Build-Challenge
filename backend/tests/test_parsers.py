"""Unit tests for the fail-closed parsers, writhe numerics and alignment."""
from __future__ import annotations

import math

import pytest

from app import parsers
from app.align import AlignmentError, needleman_wunsch
from app.parsers import ParseError, parse_fasta, parse_pdb_text
from app.writhe import _segment_pair, writhe

# ── FASTA parsing ──────────────────────────────────────────────────────────


def test_fasta_valid_single():
    rec = parse_fasta(">sp|P18858|LIG1_HUMAN\nMQRSIMSFF\nHPKKEGKAKK\n")[0]
    assert rec.header == "sp|P18858|LIG1_HUMAN"
    assert rec.sequence == "MQRSIMSFFHPKKEGKAKK"


def test_fasta_rejects_script_payload():
    with pytest.raises(ParseError):
        parse_fasta(">x\n<script>alert(1)</script>")


def test_fasta_rejects_sql_payload():
    with pytest.raises(ParseError):
        parse_fasta(">x\nACGT; DROP TABLE proteins;--")


def test_fasta_rejects_sequence_before_header():
    with pytest.raises(ParseError):
        parse_fasta("ACGTACGT\n>x\nACGT")


def test_fasta_rejects_oversize(monkeypatch):
    monkeypatch.setattr(parsers, "_MAX_FASTA_BYTES", 50)
    with pytest.raises(ParseError):
        parse_fasta(">x\n" + "A" * 100)


# ── PDB parsing ────────────────────────────────────────────────────────────


def _atom_line(serial, name, resname, chain, resseq, x, y, z, b=42.5):
    return (
        f"ATOM  {serial:5d} {name:>4s} {resname:>3s} {chain}{resseq:4d}    "
        f"{x:8.3f}{y:8.3f}{z:8.3f}{1.0:6.2f}{b:6.2f}          C  "
    )


def _metal_line(serial, element, chain, resseq, x, y, z):
    return (
        f"HETATM{serial:5d} {element:>4s} {element:>3s} {chain}{resseq:4d}    "
        f"{x:8.3f}{y:8.3f}{z:8.3f}{1.0:6.2f}{50.0:6.2f}          {element:>2s}"
    )


def test_pdb_parses_ca_and_metals():
    text = "\n".join(
        [
            "TITLE     TEST PROTEIN",
            _atom_line(1, "CA", "LYS", "A", 32, 12.345, -34.567, 56.789),
            _atom_line(2, "CB", "LYS", "A", 32, 13.0, -35.0, 57.0),  # non-CA atom: ignored
            _atom_line(3, "CA", "GLU", "A", 33, 12.5, -34.0, 57.5),
            _metal_line(500, "MG", "A", 201, 10.0, 20.0, 30.0),
            "END",
        ]
    )
    parsed = parse_pdb_text(text)
    assert parsed.title == "TEST PROTEIN"
    assert len(parsed.points) == 2
    assert parsed.points[0].resname == "LYS"
    assert parsed.points[0].resseq == 32
    assert parsed.points[0].x == pytest.approx(12.345)
    assert parsed.points[0].bfactor == pytest.approx(42.5)
    assert len(parsed.metals) == 1
    assert parsed.metals[0].element == "MG"


def test_pdb_skips_malformed_coordinates():
    good = _atom_line(1, "CA", "LYS", "A", 32, 12.345, -34.567, 56.789)
    # hand-built line whose float columns are not parseable
    bad = (
        "ATOM      2  CA  GLU A  33      not.a   bad  57.000  1.00 42.50           C"
    )
    parsed = parse_pdb_text(good + "\n" + bad)
    assert len(parsed.points) == 1  # malformed record skipped, not guessed


def test_pdb_rejects_oversize(monkeypatch):
    monkeypatch.setattr(parsers, "_MAX_PDB_BYTES", 100)
    with pytest.raises(ParseError):
        parse_pdb_text("x" * 500)


# ── Writhe numerics (validated against analytic results) ──────────────────


def _circle(n=120):
    return [(math.cos(2 * math.pi * i / n), math.sin(2 * math.pi * i / n), 0.0) for i in range(n + 1)]


def _helix(n_turns=3, pts_per_turn=40, radius=2.0, handedness=1):
    # rise per turn = 2πR ⇒ pitch angle 45°
    pts = []
    for k in range(n_turns * pts_per_turn + 1):
        t = 2 * math.pi * k / pts_per_turn
        pts.append((radius * math.cos(t), handedness * radius * math.sin(t), radius * t))
    return pts


def test_writhe_planar_circle_is_zero():
    assert abs(writhe(_circle())) < 0.02


def test_writhe_right_helix_positive_and_converged():
    # The N(1 − sin α) formula applies to *closed* helices; for an *open*
    # 3-turn 45° helix the Gauss writhe converges to ≈ 0.355 (verified by
    # the Hopf-link exact test below, which pins the kernel's normalization).
    w = writhe(_helix(3))
    assert w > 0, "right-handed helix must have positive writhe"
    assert abs(w - 0.355) < 0.02


def test_writhe_mirror_helix_negative():
    assert writhe(_helix(3, handedness=-1)) < 0


def test_gauss_kernel_matches_exact_linking_numbers():
    """The Gauss kernel is the linking-number integral: a Hopf link must give
    |Lk| = 1 and unlinked circles 0. This pins formula sign and normalization."""
    n = 200
    circle_a = [(math.cos(t), math.sin(t), 0.0) for t in [2 * math.pi * i / n for i in range(n + 1)]]
    circle_b = [(0.0, 1.0 + math.cos(s), math.sin(s)) for s in [2 * math.pi * i / n for i in range(n + 1)]]
    circle_c = [(0.0, 5.0 + math.cos(s), math.sin(s)) for s in [2 * math.pi * i / n for i in range(n + 1)]]

    def lk(a, b, m=4):
        acc = 0.0
        for i in range(len(a) - 1):
            a0, a1 = a[i], a[i + 1]
            ax, ay, az = a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]
            for j in range(len(b) - 1):
                b0, b1 = b[j], b[j + 1]
                acc += _segment_pair(a0, ax, ay, az, b0, b1, m)
        return acc / (4.0 * math.pi)

    assert abs(lk(circle_a, circle_b)) == pytest.approx(1.0, abs=0.01)
    assert abs(lk(circle_a, circle_c)) == pytest.approx(0.0, abs=0.01)


# ── Alignment ──────────────────────────────────────────────────────────────


def test_nw_known_pair():
    aln = needleman_wunsch("ACGT", "AGT")
    assert aln.aligned_a == "ACGT"
    assert aln.aligned_b == "A-GT"
    assert aln.score == 4  # +2 −2 +2 +2
    assert aln.identity_pct == 100.0  # identity = matches over non-gap columns


def test_nw_identity_excludes_gaps():
    aln = needleman_wunsch("ACGT", "ACGA")  # 3 matches, 1 mismatch
    assert aln.score == 5  # +2 +2 +2 −1
    assert aln.identity_pct == 75.0
    assert aln.mismatches == 1


def test_nw_identical():
    aln = needleman_wunsch("ACGT", "ACGT")
    assert aln.score == 8
    assert aln.identity_pct == 100.0
    assert aln.gaps == 0


def test_nw_rejects_empty():
    with pytest.raises(AlignmentError):
        needleman_wunsch("", "ACGT")


def test_nw_rejects_oversize():
    with pytest.raises(AlignmentError):
        needleman_wunsch("A" * 1501, "A" * 10)
