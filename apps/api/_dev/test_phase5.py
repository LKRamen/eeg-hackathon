"""Phase 5 tests: end-to-end pipeline orchestration."""

from __future__ import annotations

from urllib.parse import urlparse

import pytest

from apps.api.models.schemas import BrandResult, Persona
from apps.api.services._openai_client import get_openai_client
from apps.api.services._brand_orchestrator import run_pipeline


SAMPLE_PERSONA = Persona(
    name="Mio",
    age_range="24-32",
    location_archetype="urban-creative",
    psychographics=["independent", "curious", "minimal"],
    interests=["indie games", "ambient music", "matcha"],
    purchase_signals=["small batch", "considered design"],
    aesthetic_keywords=["matte black", "brutalist concrete", "Tokyo neon"],
    voice_traits=["dry", "observational", "knowing"],
    summary="Designs sound for indie games at night.",
)


@pytest.mark.asyncio
async def test_run_pipeline_returns_populated_result() -> None:
    get_openai_client.cache_clear()
    result = await run_pipeline(SAMPLE_PERSONA, "matcha drink", "pipe-1")

    assert isinstance(result, BrandResult)
    assert result.brand_assets.brand_name
    assert len(result.brand_assets.palette) == 5
    assert len(result.agency_matches) >= 1

    # Brand guide is the only required artifact.
    assert result.brand_guide_pdf_url
    assert urlparse(result.brand_guide_pdf_url).scheme in ("file", "http", "https")

    # Optional artifacts — should populate when their builds succeed.
    assert result.pitch_deck_pdf_url is not None
    assert result.mfg_spec_sheet_pdf_url is not None
    assert result.web_guide_url is not None
    assert result.brand_kit_zip_url is not None


@pytest.mark.asyncio
async def test_run_pipeline_top_match_drives_pitch_deck_copy() -> None:
    """Pipeline picks agency_matches[0] for the pitch deck slide."""
    get_openai_client.cache_clear()
    result = await run_pipeline(SAMPLE_PERSONA, "matcha drink", "pipe-2")
    top = result.agency_matches[0]
    assert top.match_score >= 0.0
    # The pitch deck PDF (or HTML fallback) should reference the top match.
    # We don't fetch and parse it here — just confirm top match is present
    # and the pitch_deck artifact exists.
    assert result.pitch_deck_pdf_url is not None


@pytest.mark.asyncio
async def test_brand_result_serializable_to_json() -> None:
    """BrandResult must round-trip through model_dump_json for the API layer."""
    get_openai_client.cache_clear()
    result = await run_pipeline(SAMPLE_PERSONA, "matcha drink", "pipe-3")
    payload = result.model_dump_json()
    assert result.brand_assets.brand_name in payload
    assert "palette" in payload
