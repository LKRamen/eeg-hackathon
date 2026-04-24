"""Phase 3 tests: pitch deck + web guide + mfg spec."""

from __future__ import annotations

from urllib.parse import urlparse

import pytest

from apps.api.models.schemas import AgencyMatch, Persona
from apps.api.services._openai_client import get_openai_client
from apps.api.services._export_mfg import (
    closest_pantone,
    hex_to_cmyk,
    hex_to_rgb,
    render_mfg_spec_html,
)
from apps.api.services.brand import assemble
from apps.api.services.export import (
    build_mfg_spec,
    build_pitch_deck,
    build_web_guide,
    render_pitch_deck_html,
    render_web_guide_html,
)


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

SAMPLE_MATCH = AgencyMatch(
    id="agency-1",
    name="Studio Quiet",
    blurb="Independent brand studio for considered makers.",
    specialty_tags=["brand identity", "packaging"],
    aesthetic_tags=["minimal", "considered"],
    notable_clients=["Ferment", "Plot"],
    min_budget="$15k",
    website="https://studioquiet.com",
    match_score=0.86,
    why="Both work in a quiet, considered register; aesthetic overlap on brutalist + minimal.",
)


# ---------------- color helpers ----------------

def test_hex_to_rgb_known_values() -> None:
    assert hex_to_rgb("#ffffff") == (255, 255, 255)
    assert hex_to_rgb("#000000") == (0, 0, 0)
    assert hex_to_rgb("#ff0000") == (255, 0, 0)


def test_hex_to_cmyk_pure_black_and_white() -> None:
    assert hex_to_cmyk("#000000") == (0, 0, 0, 100)
    assert hex_to_cmyk("#ffffff") == (0, 0, 0, 0)


def test_closest_pantone_returns_matching_name_for_black() -> None:
    assert "Black" in closest_pantone("#000000")


# ---------------- pitch deck ----------------

@pytest.mark.asyncio
async def test_pitch_deck_html_includes_5_slides() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "deck-1")
    html = render_pitch_deck_html(brand, SAMPLE_PERSONA, SAMPLE_MATCH)

    for marker in (
        "SLIDE 1 — TITLE",
        "SLIDE 2 — CUSTOMER",
        "SLIDE 3 — BRAND",
        "SLIDE 4 — IN THE WORLD",
        "SLIDE 5 — ASK",
    ):
        assert marker in html, f"missing slide: {marker}"

    assert "@page { size: A4 landscape" in html
    assert SAMPLE_MATCH.name in html
    assert brand.brand_name in html


@pytest.mark.asyncio
async def test_build_pitch_deck_produces_url() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "deck-2")
    url = await build_pitch_deck(brand, SAMPLE_PERSONA, SAMPLE_MATCH, "deck-2")
    assert urlparse(url).scheme in ("file", "https", "http")
    assert "pitch_deck" in url


# ---------------- web guide ----------------

@pytest.mark.asyncio
async def test_web_guide_includes_js_and_fonts_link() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "web-1")
    downloads = {
        "brand_guide_pdf_url": "file:///tmp/g.pdf",
        "pitch_deck_pdf_url": "file:///tmp/d.pdf",
        "brand_kit_zip_url": "file:///tmp/k.zip",
    }
    html = render_web_guide_html(brand, SAMPLE_PERSONA, downloads)
    assert "fonts.googleapis.com/css2" in html
    assert "navigator.clipboard" in html
    assert "scroll-behavior: smooth" in html
    for anchor in ("#hero", "#customer", "#identity", "#color", "#type", "#voice"):
        assert anchor in html
    for url in downloads.values():
        assert url in html


@pytest.mark.asyncio
async def test_build_web_guide_uploads_html() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "web-2")
    url = await build_web_guide(brand, SAMPLE_PERSONA, "web-2")
    assert "index.html" in url


# ---------------- mfg spec ----------------

@pytest.mark.asyncio
async def test_mfg_spec_html_has_rgb_and_cmyk_for_each_palette_color() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "mfg-1")
    html = render_mfg_spec_html(brand)

    for c in brand.palette:
        rgb = hex_to_rgb(c.hex)
        cmyk = hex_to_cmyk(c.hex)
        assert c.hex in html
        assert f"R{rgb[0]} G{rgb[1]} B{rgb[2]}" in html
        assert f"C{cmyk[0]} M{cmyk[1]} Y{cmyk[2]} K{cmyk[3]}" in html


@pytest.mark.asyncio
async def test_build_mfg_spec_produces_url() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "mfg-2")
    url = await build_mfg_spec(brand, "mfg-2")
    assert "mfg_spec" in url
