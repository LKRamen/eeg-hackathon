"""Phase 4 tests: brand kit ZIP bundle."""

from __future__ import annotations

import io
import zipfile
from pathlib import Path
from unittest.mock import AsyncMock, patch
from urllib.parse import urlparse
from urllib.request import url2pathname

import pytest

from apps.api.models.schemas import Persona
from apps.api.services._openai_client import get_openai_client
from apps.api.services._export_zip import build_brand_kit_zip
from apps.api.services.brand import assemble


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

# Smallest valid PNG (1x1 transparent).
TINY_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


def _zip_url_to_path(url: str) -> Path:
    parsed = urlparse(url)
    return Path(url2pathname(parsed.path))


async def _fake_get(self, url, timeout=None, follow_redirects=False):
    """AsyncMock-style replacement for httpx.AsyncClient.get."""
    resp = AsyncMock()
    resp.status_code = 200
    resp.content = TINY_PNG
    resp.raise_for_status = lambda: None
    return resp


@pytest.mark.asyncio
async def test_zip_contains_expected_entries() -> None:
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "zip-1")

    # Provide some pdf URLs that exist on disk (file://); guide cache is real.
    fake_pdf_path = _make_local_pdf("zip-1", "brand_guide.pdf")
    fake_deck_path = _make_local_pdf("zip-1", "pitch_deck.pdf")
    fake_mfg_path = _make_local_pdf("zip-1", "mfg_spec.pdf")

    with patch(
        "httpx.AsyncClient.get", new=_fake_get
    ):
        url = await build_brand_kit_zip(
            brand,
            SAMPLE_PERSONA,
            fake_pdf_path.as_uri(),
            fake_deck_path.as_uri(),
            fake_mfg_path.as_uri(),
            job_id="zip-1",
        )

    zip_path = _zip_url_to_path(url)
    assert zip_path.exists()
    assert zip_path.suffix == ".zip"

    with zipfile.ZipFile(zip_path) as zf:
        names = set(zf.namelist())
        assert "brand.json" in names
        assert "README.txt" in names
        assert any(n.startswith("logo/") for n in names)
        assert any(n.startswith("mockups/") for n in names)
        assert any(n.startswith("social/") for n in names)
        assert "docs/brand_guide.pdf" in names
        assert "docs/pitch_deck.pdf" in names
        assert "docs/mfg_spec.pdf" in names

        with zf.open("brand.json") as f:
            payload = f.read()
            assert b"brand_name" in payload
            assert b"palette" in payload
            assert brand.brand_name.encode() in payload


@pytest.mark.asyncio
async def test_zip_skips_failed_fetches() -> None:
    """One unreachable PNG must not kill the bundle."""
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "zip-2")

    async def flaky_get(self, url, timeout=None, follow_redirects=False):
        if "HERO" in url:
            raise RuntimeError("network error")
        resp = AsyncMock()
        resp.status_code = 200
        resp.content = TINY_PNG
        resp.raise_for_status = lambda: None
        return resp

    with patch("httpx.AsyncClient.get", new=flaky_get):
        url = await build_brand_kit_zip(
            brand, SAMPLE_PERSONA, None, None, None, job_id="zip-2"
        )

    with zipfile.ZipFile(_zip_url_to_path(url)) as zf:
        names = zf.namelist()
        # README + brand.json must exist; failed asset (HERO) absent.
        assert "brand.json" in names
        assert "README.txt" in names
        assert not any("hero" in n.lower() for n in names)


@pytest.mark.asyncio
async def test_zip_works_without_doc_urls() -> None:
    """No PDFs supplied → ZIP still produced with assets and brand.json."""
    get_openai_client.cache_clear()
    brand = await assemble(SAMPLE_PERSONA, "matcha drink", "zip-3")

    with patch("httpx.AsyncClient.get", new=_fake_get):
        url = await build_brand_kit_zip(
            brand, SAMPLE_PERSONA, None, None, None, job_id="zip-3"
        )

    with zipfile.ZipFile(_zip_url_to_path(url)) as zf:
        names = zf.namelist()
        assert "brand.json" in names
        assert not any(n.startswith("docs/") for n in names)


def _make_local_pdf(job_id: str, name: str) -> Path:
    cache = Path(__file__).resolve().parent.parent / "cache" / "brand-guides" / "jobs" / job_id
    cache.mkdir(parents=True, exist_ok=True)
    p = cache / name
    p.write_bytes(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n%%EOF\n")
    return p
