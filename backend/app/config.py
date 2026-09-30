"""BioStream backend configuration.

Every secret lives here and is injected from `backend/.env` at boot time.
Nothing in this module is ever returned to the client — `/api/health`
reports only *which* integrations are configured, never key material.
"""
from __future__ import annotations

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ── Public data services (keyless, safe URLs) ──────────────────────────
    uniprot_base_url: str = "https://rest.uniprot.org"
    ensembl_base_url: str = "https://rest.ensembl.org"
    interpro_base_url: str = "https://www.ebi.ac.uk/interpro/api"
    alphamissense_base_url: str = "https://alphamissense.hegelab.org"
    alphafold_base_url: str = "https://alphafold.ebi.ac.uk/api"

    # ── Optional credentials (server-side only — NEVER send to the client) ──
    ensembl_api_key: str | None = None
    anthropic_api_key: str | None = None
    pinecone_api_key: str | None = None
    pinecone_environment: str | None = None

    # ── Application behaviour ───────────────────────────────────────────────
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    ortholog_species: str = "balaenoptera_musculus,balaenoptera_acutorostrata,physeter_catodon"
    rate_limit_per_minute: int = 120
    request_timeout_s: float = 25.0
    variant_timeout_s: float = 60.0
    trust_proxy: bool = False

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ortholog_species_list(self) -> list[str]:
        return [o.strip() for o in self.ortholog_species.split(",") if o.strip()]

    @property
    def configured_services(self) -> dict[str, bool]:
        """Which integrations are usable. Booleans only — never key values."""
        return {
            "uniprot": True,
            "ensembl": True,
            "interpro": True,
            "alphamissense": True,
            "alphafold": True,
            "vep_sift": True,
            "agentic_llm": self.anthropic_api_key is not None,
            "vector_store": self.pinecone_api_key is not None,
        }


@lru_cache
def get_settings() -> Settings:
    return Settings()
