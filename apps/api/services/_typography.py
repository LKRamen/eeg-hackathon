from __future__ import annotations

import logging
from typing import Any

from apps.api.models.schemas import FontSpec, Persona, Typography

from ._openai_client import call_json_mode, get_openai_client

logger = logging.getLogger(__name__)

WHITELIST: frozenset[str] = frozenset({
    "Inter", "Space Grotesk", "DM Sans", "Manrope", "Plus Jakarta Sans",
    "Geist", "Bricolage Grotesque", "Fraunces", "Playfair Display",
    "Crimson Pro", "EB Garamond", "Cormorant", "Lora", "Instrument Serif",
    "JetBrains Mono", "IBM Plex Sans", "IBM Plex Serif", "IBM Plex Mono",
    "Bebas Neue", "Archivo", "Syne", "Outfit", "Sora",
    "Big Shoulders Display", "Unica One",
})

DEFAULT_WEIGHTS: tuple[int, ...] = (400, 700)

SYSTEM_PROMPT = (
    "You are a type designer who pairs Google Fonts. You pick a display "
    "face with character and a body face that's invisible at 14px. They "
    "share a vibe but never the same category."
)


def _build_google_url(family: str, weights: tuple[int, ...] = DEFAULT_WEIGHTS) -> str:
    slug = family.replace(" ", "+")
    weight_spec = ";".join(str(w) for w in weights)
    return (
        f"https://fonts.googleapis.com/css2?family={slug}:wght@{weight_spec}"
        "&display=swap"
    )


def _make_spec(family: str) -> FontSpec:
    return FontSpec(
        family=family,
        google_url=_build_google_url(family),
        weights=list(DEFAULT_WEIGHTS),
    )


def _validate(parsed: dict[str, Any]) -> Typography:
    display = parsed.get("display", {})
    body = parsed.get("body", {})
    display_fam = (display.get("family") if isinstance(display, dict) else display) or ""
    body_fam = (body.get("family") if isinstance(body, dict) else body) or ""
    display_fam = str(display_fam).strip()
    body_fam = str(body_fam).strip()

    if display_fam not in WHITELIST:
        raise ValueError(f"display family {display_fam!r} is not in the whitelist")
    if body_fam not in WHITELIST:
        raise ValueError(f"body family {body_fam!r} is not in the whitelist")
    if display_fam == body_fam:
        raise ValueError("display and body must be different families")

    return Typography(display=_make_spec(display_fam), body=_make_spec(body_fam))


def _fallback_typography(persona: Persona) -> Typography:
    return Typography(
        display=_make_spec("Space Grotesk"),
        body=_make_spec("Inter"),
    )


async def generate_typography(persona: Persona) -> Typography:
    """Pick two complementary Google Fonts from the whitelist for the brand."""
    client = get_openai_client()
    if client is None:
        logger.info("generate_typography: no OpenAI key, using fixture")
        return _fallback_typography(persona)

    whitelist_str = ", ".join(sorted(WHITELIST))
    user = (
        "Pick 2 Google Fonts for a brand whose aesthetic is:\n"
        f"{persona.aesthetic_keywords}\n"
        f"Voice: {persona.voice_traits}\n\n"
        "- DISPLAY for headings: high personality, expressive\n"
        "- BODY for paragraphs: highly readable at 14px\n\n"
        "They should pair (not both display, not redundantly serif).\n\n"
        f"Pick ONLY from this whitelist: {whitelist_str}\n\n"
        'Return JSON: {"display": {"family": "..."}, "body": {"family": "..."}}'
    )
    try:
        return await call_json_mode(
            client=client,
            system=SYSTEM_PROMPT,
            user=user,
            validator=_validate,
            temperature=0.7,
            repair_hint="Pick again, both from the whitelist, and not the same family.",
        )
    except ValueError as err:
        logger.warning("typography retry exhausted (%s); using fallback", err)
        return _fallback_typography(persona)
