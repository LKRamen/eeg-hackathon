"""Stub for Person 2's suggest_brand_name.

Replace `from apps.api.services._brand_name_stub import suggest_brand_name`
with the real Person 2 module once it lands.
"""

from __future__ import annotations

import re

from apps.api.models.schemas import Persona


def _slug(s: str) -> str:
    return re.sub(r"[^a-z]", "", s.lower())


async def suggest_brand_name(persona: Persona, product_idea: str) -> str:
    """Pick a one-word brand name from the persona's aesthetic vocabulary."""
    candidates = [
        _slug(kw.split()[0]) for kw in persona.aesthetic_keywords if kw.strip()
    ]
    candidates = [c for c in candidates if 3 <= len(c) <= 8]
    if candidates:
        return candidates[0].capitalize()

    fallback_words = ("Hush", "Mote", "Pith", "Rind", "Glaze")
    seed = sum(ord(c) for c in product_idea) if product_idea else 0
    return fallback_words[seed % len(fallback_words)]
