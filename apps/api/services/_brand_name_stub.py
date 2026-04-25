from __future__ import annotations

import json
import logging
import re

from ..config import get_settings
from ..models.schemas import Persona

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = """\
You are a brand naming consultant with impeccable taste. You create names that feel discovered, not invented.
Rules:
- 1-2 syllables, easy to spell and say
- No portmanteaus, no -ly suffixes, no dropped vowels
- Not the name of an existing major brand in the category
- Evocative of the aesthetic — not literal about the product
- Slightly unusual, immediately visual

Respond with valid JSON only. No preamble, no markdown.\
"""


async def suggest_brand_name(persona: Persona, product_idea: str) -> str:
    """Generate a brand name using Claude, falling back to keyword-based if needed."""
    settings = get_settings()
    key = settings.anthropic_api_key or None

    if key:
        try:
            from anthropic import AsyncAnthropic
            client = AsyncAnthropic(api_key=key)

            prompt = (
                f"PRODUCT: {product_idea}\n"
                f"AESTHETIC: {', '.join(persona.aesthetic_keywords)}\n"
                f"VOICE TRAITS: {', '.join(persona.voice_traits)}\n"
                f"VIBE: {persona.summary[:200]}\n\n"
                'Return JSON: {"names": ["name1","name2","name3","name4","name5"], "recommended": "name"}\n'
                "Pick the recommended name as the one that feels most inevitable, not clever."
            )

            resp = await client.messages.create(
                model=MODEL,
                max_tokens=200,
                temperature=0.9,
                system=_SYSTEM,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            data = json.loads(text)
            name = data.get("recommended") or (data.get("names") or [None])[0]
            if name and isinstance(name, str) and re.match(r"^[A-Za-z][A-Za-z\s'\-\.]{0,15}$", name):
                logger.info("Brand name generated: %s (options: %s)", name, data.get("names"))
                return name.strip()
        except Exception as exc:
            logger.warning("Brand name Claude call failed (%s), using fallback", exc)

    # Keyword-based fallback
    candidates = [
        re.sub(r"[^a-z]", "", kw.split()[0].lower())
        for kw in persona.aesthetic_keywords
        if kw.strip()
    ]
    candidates = [c for c in candidates if 3 <= len(c) <= 8]
    if candidates:
        return candidates[0].capitalize()

    fallback = ("Hush", "Mote", "Pith", "Rind", "Glaze")
    seed = sum(ord(c) for c in product_idea) if product_idea else 0
    return fallback[seed % len(fallback)]
