from __future__ import annotations

import asyncio
import logging
import re

from ..models.schemas import BrandAssets, Persona

from ._brand_name_stub import suggest_brand_name
from .images import generate_logo_set, generate_mockups, generate_social_kit
from ._palette import generate_palette
from ._typography import generate_typography
from ._voice import generate_voice

__all__ = [
    "generate_palette",
    "generate_typography",
    "generate_voice",
    "assemble",
]

logger = logging.getLogger(__name__)


def _strip_trailing_punct(text: str) -> str:
    return re.sub(r"[.!?]+\s*$", "", text or "").strip()


def _primary_hex(palette) -> str:
    for c in palette:
        if c.role == "primary":
            return c.hex
    if palette:
        return palette[0].hex
    return "#0a0a0a"


async def assemble(persona: Persona, product_idea: str, job_id: str) -> BrandAssets:
    """Run the full brand assembly graph in parallel where possible.

    Order:
      1. brand_name (P2)
      2. parallel: palette + typography + voice
      3. parallel: logo set + mockups (need primary hex from palette)
      4. social kit (needs logo.mono_dark)
    """
    try:
        brand_name = await suggest_brand_name(persona, product_idea)

        palette, typography, voice = await asyncio.gather(
            generate_palette(persona, product_idea),
            generate_typography(persona),
            generate_voice(brand_name, product_idea, persona),
        )

        primary_hex = _primary_hex(palette)
        logo, mockups = await asyncio.gather(
            generate_logo_set(brand_name, product_idea, persona, primary_hex, job_id),
            generate_mockups(brand_name, persona, job_id, brand_color_hex=primary_hex, product_idea=product_idea),
        )

        tagline = ""
        if voice.examples:
            tagline = _strip_trailing_punct(voice.examples[0])

        social_kit = await generate_social_kit(
            brand_name, tagline, persona, logo.mono_dark, primary_hex, job_id,
            display_font=typography.display.family if typography and typography.display else None,
        )

        return BrandAssets(
            brand_name=brand_name,
            tagline=tagline,
            logo_url=logo.primary,
            logo=logo,
            palette=palette,
            typography=typography,
            voice=voice,
            mockups=mockups,
            social_kit=social_kit,
        )
    except Exception:
        logger.exception("brand.assemble failed for job_id=%s", job_id)
        raise
