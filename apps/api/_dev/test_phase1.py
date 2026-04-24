"""Phase 1 tests: palette, typography, voice wrappers.

Two modes verified per service:
  - Fixture mode (no OPENAI_API_KEY): returns deterministic fallback.
  - Mocked mode: AsyncOpenAI is patched to inject specific responses,
    exercising the JSON parse + Pydantic validate + retry path.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from apps.api.models.schemas import Persona, Typography, Voice
from apps.api.services._openai_client import get_openai_client
from apps.api.services._palette import (
    contrast_ratio,
    generate_palette,
)
from apps.api.services._typography import generate_typography
from apps.api.services._voice import generate_voice


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


def _make_chat_response(content: str) -> MagicMock:
    msg = MagicMock()
    msg.content = content
    choice = MagicMock()
    choice.message = msg
    resp = MagicMock()
    resp.choices = [choice]
    return resp


def _mock_client(*responses: str) -> MagicMock:
    """A fake AsyncOpenAI whose chat.completions.create yields each response in turn."""
    client = MagicMock()
    create = AsyncMock(side_effect=[_make_chat_response(r) for r in responses])
    client.chat.completions.create = create
    return client


# ---------------- fixture mode (no OPENAI key) ----------------


@pytest.mark.asyncio
async def test_palette_fixture_shape() -> None:
    get_openai_client.cache_clear()
    colors = await generate_palette(SAMPLE_PERSONA, "matcha drink")
    assert len(colors) == 5
    roles = {c.role for c in colors}
    assert roles == {"primary", "secondary", "accent", "bg", "fg"}
    bg = next(c for c in colors if c.role == "bg")
    fg = next(c for c in colors if c.role == "fg")
    assert contrast_ratio(bg.hex, fg.hex) >= 4.5


@pytest.mark.asyncio
async def test_typography_fixture_shape() -> None:
    get_openai_client.cache_clear()
    typo = await generate_typography(SAMPLE_PERSONA)
    assert isinstance(typo, Typography)
    assert typo.display.family != typo.body.family
    assert "fonts.googleapis.com/css2" in typo.display.google_url
    assert typo.display.weights == [400, 700]


@pytest.mark.asyncio
async def test_voice_fixture_shape() -> None:
    get_openai_client.cache_clear()
    voice = await generate_voice("Hush", "matcha drink", SAMPLE_PERSONA)
    assert isinstance(voice, Voice)
    assert len(voice.examples) == 3
    assert not voice.examples[0].endswith(".")
    assert "!" not in " ".join(voice.examples)


# ---------------- contrast helper ----------------


def test_contrast_ratio_extremes() -> None:
    assert contrast_ratio("#ffffff", "#000000") == pytest.approx(21.0, abs=0.01)
    assert contrast_ratio("#ffffff", "#ffffff") == pytest.approx(1.0, abs=0.01)


# ---------------- retry path (mocked client) ----------------

def _good_palette() -> str:
    return json.dumps({
        "palette": [
            {"hex": "#0a0a0a", "role": "primary", "name": "ink"},
            {"hex": "#f5f1e8", "role": "secondary", "name": "bone"},
            {"hex": "#c2410c", "role": "accent", "name": "rust"},
            {"hex": "#ffffff", "role": "bg", "name": "paper"},
            {"hex": "#0a0a0a", "role": "fg", "name": "char"},
        ]
    })


def _bad_palette_low_contrast() -> str:
    return json.dumps({
        "palette": [
            {"hex": "#0a0a0a", "role": "primary", "name": "ink"},
            {"hex": "#f5f1e8", "role": "secondary", "name": "bone"},
            {"hex": "#c2410c", "role": "accent", "name": "rust"},
            {"hex": "#cccccc", "role": "bg", "name": "stone"},
            {"hex": "#dddddd", "role": "fg", "name": "fog"},
        ]
    })


@pytest.mark.asyncio
async def test_palette_retries_then_succeeds() -> None:
    """First response fails contrast; retry returns valid palette."""
    get_openai_client.cache_clear()
    fake_client = _mock_client(_bad_palette_low_contrast(), _good_palette())
    with patch(
        "apps.api.services._palette.get_openai_client", return_value=fake_client
    ):
        colors = await generate_palette(SAMPLE_PERSONA, "matcha drink")
    assert len(colors) == 5
    assert fake_client.chat.completions.create.call_count == 2


@pytest.mark.asyncio
async def test_typography_retries_then_succeeds() -> None:
    """First response uses non-whitelisted family; retry returns valid pair."""
    get_openai_client.cache_clear()
    bad = json.dumps({"display": {"family": "Comic Sans"}, "body": {"family": "Inter"}})
    good = json.dumps({"display": {"family": "Space Grotesk"}, "body": {"family": "Inter"}})
    fake_client = _mock_client(bad, good)
    with patch(
        "apps.api.services._typography.get_openai_client", return_value=fake_client
    ):
        typo = await generate_typography(SAMPLE_PERSONA)
    assert typo.display.family == "Space Grotesk"
    assert typo.body.family == "Inter"
    assert fake_client.chat.completions.create.call_count == 2


@pytest.mark.asyncio
async def test_voice_retries_on_banned_word() -> None:
    """First response uses 'revolutionary'; retry strips it."""
    get_openai_client.cache_clear()
    bad = json.dumps({
        "tone": "bold and brave",
        "do": ["a", "b", "c"],
        "dont": ["x", "y", "z"],
        "examples": [
            "a revolutionary new drink",
            "bold matcha for bold people",
            "drop one. limited batch.",
        ],
    })
    good = json.dumps({
        "tone": "dry, observational",
        "do": ["use lowercase", "name what it does", "favor short sentences"],
        "dont": ["no exclamations", "no 'introducing'", "no boilerplate"],
        "examples": [
            "made small.",
            "a quiet take on matcha.",
            "drop one. limited batch.",
        ],
    })
    fake_client = _mock_client(bad, good)
    with patch(
        "apps.api.services._voice.get_openai_client", return_value=fake_client
    ):
        voice = await generate_voice("Hush", "matcha drink", SAMPLE_PERSONA)
    assert "!" not in " ".join(voice.examples)
    assert not voice.examples[0].endswith(".")
    assert fake_client.chat.completions.create.call_count == 2


@pytest.mark.asyncio
async def test_voice_strips_trailing_period_from_tagline() -> None:
    get_openai_client.cache_clear()
    payload = json.dumps({
        "tone": "calm, deliberate",
        "do": ["a", "b", "c"],
        "dont": ["x", "y", "z"],
        "examples": ["made small.", "a quiet take on matcha.", "drop one. limited."],
    })
    fake_client = _mock_client(payload)
    with patch(
        "apps.api.services._voice.get_openai_client", return_value=fake_client
    ):
        voice = await generate_voice("Hush", "matcha", SAMPLE_PERSONA)
    assert voice.examples[0] == "made small"


if __name__ == "__main__":
    asyncio.run(test_palette_fixture_shape())
    asyncio.run(test_typography_fixture_shape())
    asyncio.run(test_voice_fixture_shape())
    print("smoke: ok")
