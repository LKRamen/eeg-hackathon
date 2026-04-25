"""Stubs for Person 3's image module.

Returns placeholder URLs that satisfy the LogoVariants / Mockup /
SocialAsset shapes so Phase 2 can run end-to-end without P3's code.

Swap `from apps.api.services._images_stub import ...` with the real
P3 imports once their module is published.
"""

from __future__ import annotations

import urllib.parse

from apps.api.models.schemas import (
    LogoVariants,
    Mockup,
    Persona,
    SocialAsset,
)


def _placeholder(text: str, fg: str = "fff", bg: str = "000", size: str = "1024x1024") -> str:
    safe = urllib.parse.quote(text)
    return f"https://placehold.co/{size}/{bg}/{fg}?text={safe}"


async def generate_logo_set(
    brand_name: str,
    persona: Persona,
    brand_color_hex: str,
    job_id: str,
) -> LogoVariants:
    accent = brand_color_hex.lstrip("#")
    return LogoVariants(
        primary=_placeholder(brand_name, fg="fff", bg=accent),
        mono_dark=_placeholder(brand_name, fg="0a0a0a", bg="ffffff"),
        mono_light=_placeholder(brand_name, fg="ffffff", bg="0a0a0a"),
        on_brand=_placeholder(brand_name, fg="ffffff", bg=accent),
        avatar=_placeholder(
            brand_name[:2].upper(), fg="ffffff", bg=accent, size="512x512"
        ),
    )


async def generate_mockups(
    brand_name: str,
    persona: Persona,
    brand_color_hex: str,
    job_id: str,
) -> list[Mockup]:
    accent = brand_color_hex.lstrip("#")
    return [
        Mockup(label="tee", url=_placeholder(f"{brand_name} TEE", bg=accent, size="1200x900")),
        Mockup(label="tote", url=_placeholder(f"{brand_name} TOTE", bg=accent, size="1200x900")),
        Mockup(label="hat", url=_placeholder(f"{brand_name} HAT", bg=accent, size="1200x900")),
        Mockup(label="sticker", url=_placeholder(brand_name, bg=accent, size="800x800")),
    ]


async def generate_social_kit(
    brand_name: str,
    persona: Persona,
    brand_color_hex: str,
    logo_mono_dark_url: str,
    job_id: str,
) -> list[SocialAsset]:
    accent = brand_color_hex.lstrip("#")
    return [
        SocialAsset(
            label="ig_post_hero",
            url=_placeholder(f"{brand_name} HERO", bg=accent, size="1080x1080"),
            format="ig_square",
        ),
        SocialAsset(
            label="ig_post_lifestyle",
            url=_placeholder(f"{brand_name}", bg=accent, size="1080x1080"),
            format="ig_square",
        ),
        SocialAsset(
            label="ig_post_quote",
            url=_placeholder("quote", bg=accent, size="1080x1080"),
            format="ig_square",
        ),
        SocialAsset(
            label="ig_story_promo",
            url=_placeholder(f"{brand_name}", bg=accent, size="1080x1920"),
            format="ig_story",
        ),
        SocialAsset(
            label="ig_story_tease",
            url=_placeholder("soon", bg=accent, size="1080x1920"),
            format="ig_story",
        ),
    ]
