"""Protein backbone writhe via the Gauss linking integral.

Wr = (1/4π) ∮∮ ((r1 − r2) · (dr1 × dr2)) / |r1 − r2|³

Computed numerically on the Cα trace (uniformly downsampled to ~160 points),
following Klenin & Langowski (2000). For an open curve this is the *signed*
writhe: a right-handed helix gives a positive value, its mirror a negative one.
"""
from __future__ import annotations

import math
from typing import Sequence, TypeVar

T = TypeVar("T")


def downsample(seq: Sequence[T], max_points: int = 160) -> list[T]:
    """Uniform stride keeping both endpoints."""
    n = len(seq)
    if n <= max_points:
        return list(seq)
    return [seq[int(k * (n - 1) / (max_points - 1))] for k in range(max_points)]


def writhe(coords: list[tuple[float, float, float]], max_points: int = 160, m: int = 4) -> float:
    pts = downsample(coords, max_points)
    n = len(pts)
    if n < 4:
        return 0.0
    acc = 0.0
    for i in range(n - 2):
        a0, a1 = pts[i], pts[i + 1]
        ax, ay, az = a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]
        for j in range(i + 2, n - 1):
            b0, b1 = pts[j], pts[j + 1]
            acc += _segment_pair(a0, ax, ay, az, b0, b1, m)
    return acc / (4.0 * math.pi)


def local_writhe(
    coords: list[tuple[float, float, float]],
    window: int = 15,
    max_points: int = 160,
    m: int = 2,
) -> list[float]:
    """Writhe of a sliding fragment around each residue (open-curve writhe)."""
    pts = downsample(coords, max_points)
    n = len(pts)
    out: list[float] = []
    for i in range(n):
        lo, hi = max(0, i - window), min(n - 1, i + window)
        frag = pts[lo : hi + 1]
        out.append(writhe(frag, m=m) if len(frag) >= 4 else 0.0)
    return out


def _segment_pair(
    a0: tuple[float, float, float],
    ax: float,
    ay: float,
    az: float,
    b0: tuple[float, float, float],
    b1: tuple[float, float, float],
    m: int,
) -> float:
    """Midpoint-quadrature Gauss integral over one segment pair."""
    bx, by, bz = b1[0] - b0[0], b1[1] - b0[1], b1[2] - b0[2]
    total = 0.0
    for p in range(m):
        u = (p + 0.5) / m
        rx = a0[0] + u * ax
        ry = a0[1] + u * ay
        rz = a0[2] + u * az
        for q in range(m):
            v = (q + 0.5) / m
            dx = rx - (b0[0] + v * bx)
            dy = ry - (b0[1] + v * by)
            dz = rz - (b0[2] + v * bz)
            d3 = (dx * dx + dy * dy + dz * dz) ** 1.5
            if d3 < 1e-12:
                continue
            # ((r1 − r2) · (dr1 × dr2)) / |r1 − r2|³  =  ((a × b) · d) / d³
            cx = ay * bz - az * by
            cy = az * bx - ax * bz
            cz = ax * by - ay * bx
            total += (cx * dx + cy * dy + cz * dz) / d3
    return total / (m * m)
