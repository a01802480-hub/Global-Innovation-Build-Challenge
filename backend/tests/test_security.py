"""Security regression tests — CSRF, injection, XSS echo, size caps, rate limiting.

These run fully offline (no external services are contacted).
"""
from __future__ import annotations

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app


def make_app(**overrides) -> FastAPI:
    kwargs = {"_env_file": None, "cors_origins": "http://localhost:3000", **overrides}
    return create_app(Settings(**kwargs))


@pytest.fixture(scope="module")
def client():
    with TestClient(make_app()) as c:
        c.get("/api/health")  # obtain the CSRF cookie
        yield c


def csrf_post(client, path, json, token=None):
    tok = token or client.cookies.get("biostream_csrf")
    return client.post(path, json=json, headers={"X-CSRF-Token": tok})


VALID_ALIGNMENT = {"sequence_a": "ACGTAC", "sequence_b": "ACGTAC"}


# ── CSRF ───────────────────────────────────────────────────────────────────


class TestCsrf:
    def test_health_is_public_and_sets_cookie(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        assert "status" in resp.json()
        # only booleans about service availability — never key material
        body = resp.text.lower()
        assert "sk-ant" not in body and "api_key" not in body

    def test_post_without_token_rejected(self):
        with TestClient(make_app()) as fresh:
            resp = fresh.post("/api/alignment/pairwise", json=VALID_ALIGNMENT)
            assert resp.status_code == 403

    def test_post_with_wrong_token_rejected(self, client):
        resp = csrf_post(client, "/api/alignment/pairwise", VALID_ALIGNMENT, token="forged-token")
        assert resp.status_code == 403

    def test_post_with_valid_token_accepted(self, client):
        resp = csrf_post(client, "/api/alignment/pairwise", VALID_ALIGNMENT)
        assert resp.status_code == 200
        assert resp.json()["aligned_a"] == "ACGTAC"

    def test_csrf_cookie_flags(self, client):
        cookie = client.cookies.get("biostream_csrf")
        assert cookie is not None
        assert len(cookie) >= 32


# ── Injection & XSS ────────────────────────────────────────────────────────


class TestInjection:
    @pytest.mark.parametrize(
        "payload",
        [
            "<script>alert(1)</script>",
            "ACGT; DROP TABLE proteins;--",
            ">evil\nACGT",
            "ACGT\x00ACGT",
            "ACGT`rm -rf /`",
            "💉💉💉ACGT",
            "A" * 3000,  # over the 2000-residue cap
        ],
    )
    def test_malformed_sequences_rejected(self, client, payload):
        resp = csrf_post(client, "/api/alignment/pairwise", {"sequence_a": payload, "sequence_b": "ACGT"})
        assert resp.status_code == 422
        # the hostile input must never be echoed back in the response
        assert "<script>" not in resp.text

    @pytest.mark.parametrize(
        "pdb",
        ["..%2F..%2Fetc%2Fpasswd", "abcd;rm", "A", "AAAAA", "1X9N%0AInjected", "%2e%2e%2f%2e%2e"],
    )
    def test_pdb_path_traversal_rejected(self, client, pdb):
        resp = client.get(f"/api/structure/rcsb/{pdb}")
        assert resp.status_code in (404, 422)

    @pytest.mark.parametrize(
        "acc",
        ["..%2F..", "P18858;SELECT", "P18858%00", "a" * 30],
    )
    def test_accession_injection_rejected(self, client, acc):
        resp = client.get(f"/api/ingest/uniprot/{acc}")
        assert resp.status_code in (404, 422)

    def test_variant_payload_rejected(self, client):
        resp = csrf_post(
            client,
            "/api/variants/impact",
            {"uniprot_id": "P18858; DROP", "position": 1, "ref": "R", "alt": "L"},
        )
        assert resp.status_code == 422


# ── Size caps & rate limiting ──────────────────────────────────────────────


class TestLimits:
    def test_oversized_body_rejected_413(self, client):
        huge = {"sequence_a": "A" * 6_000_000, "sequence_b": "A"}
        resp = csrf_post(client, "/api/alignment/pairwise", huge)
        assert resp.status_code == 413

    def test_rate_limit_enforced(self):
        with TestClient(make_app(rate_limit_per_minute=3)) as limited:
            for _ in range(3):
                assert limited.get("/api/health").status_code == 200
            assert limited.get("/api/health").status_code == 429
