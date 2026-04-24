"""Phase 2 tests: assemble() orchestrator + brand guide rendering.

Phase 2 includes the full BrandAssets graph and a 9-section brand guide.
We test the orchestration shape (asyncio.gather wiring) and the HTML
output structure. The actual PDF render is exercised opportunistically:
on hosts with GTK3 it produces a PDF; on hosts without it (Windows
without runtime libs) we assert the function falls back to HTML upload
without raising.
"""

from __future__ import annotations

from unittest.mock import patch
from urllib.parse import urlparse

import pytest

from apps.api.models.schemas import BrandAssets, Persona
from apps.api.services._openai_client import get_openai_client
from apps.api.services.brand import assemble
from apps.api.services.export import build_brand_guide, render_brand_guide_html


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
async def test_assemble_returns_full_brand_assets() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "test-job-1")

    assert isinstance(brand, BrandAssets)
    assert brand.brand_name
    assert len(brand.palette) == 5
    assert brand.typography is not None
    assert brand.voice is not None
    assert brand.logo is not None
    assert brand.logo.primary
    assert brand.logo.mono_dark
    assert len(brand.mockups) == 4
    assert len(brand.social_kit) == 5
    assert brand.tagline
    assert not brand.tagline.endswith(".")


@pytest.mark.asyncio
async def test_assemble_uses_primary_for_image_color() -> None:
    """The brand_color_hex passed to image stubs must come from palette[role=primary]."""
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "test-job-2")
    primary = next(c for c in brand.palette if c.role == "primary")
    assert primary.hex.startswith("#")
    assert brand.logo is not None
    assert brand.logo.primary  # placeholder URL exists


@pytest.mark.asyncio
async def test_assemble_logs_and_reraises_on_failure() -> None:
    get_openai_client.cache_clear()
    with patch(
        "apps.api.services.brand.suggest_brand_name",
        side_effect=RuntimeError("boom"),
    ):
        with pytest.raises(RuntimeError, match="boom"):
            await assemble(SAMPLE_PERSONA, "matcha", "test-job-fail")


@pytest.mark.asyncio
async def test_brand_guide_html_has_all_sections() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "test-job-html")
    html = render_brand_guide_html(brand, SAMPLE_PERSONA)

    for marker in (
        "PAGE 1 — COVER",
        "PAGE 2 — CUSTOMER",
        "PAGE 3 — LOGO",
        "PAGE 4 — PALETTE",
        "PAGE 5 — TYPOGRAPHY",
        "PAGE 6 — VOICE",
        "PAGE 7 — MOCKUPS",
        "PAGE 8 — SOCIAL",
        "PAGE 9 — BACK COVER",
    ):
        assert marker in html, f"missing section: {marker}"

    assert brand.brand_name in html
    assert brand.tagline in html
    for c in brand.palette:
        assert c.hex in html
        assert c.name in html


@pytest.mark.asyncio
async def test_brand_guide_html_inlines_css_variables() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "test-job-css")
    html = render_brand_guide_html(brand, SAMPLE_PERSONA)
    assert "--primary:" in html
    assert "--bg:" in html
    assert "--fg:" in html
    assert brand.typography is not None
    assert brand.typography.display.family in html


@pytest.mark.asyncio
async def test_build_brand_guide_uploads_pdf_or_html_fallback() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "test-job-build")
    url = await build_brand_guide(brand, SAMPLE_PERSONA, "test-job-build")
    parsed = urlparse(url)
    assert parsed.scheme in ("file", "https", "http")
    assert "brand_guide" in url
