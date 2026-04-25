from __future__ import annotations

import logging
import re
from typing import Any

from ..models.schemas import Persona, Voice

from ._openai_client import call_json_mode, get_openai_client

logger = logging.getLogger(__name__)

BANNED_WORDS: tuple[str, ...] = (
    "revolutionary", "innovative", "game-changing", "unleash", "elevate",
    "discerning", "ambitious", "passionate", "cutting-edge", "next-level",
    "premium",
)
BAN_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in BANNED_WORDS) + r")\b",
    re.IGNORECASE,
)
INTRODUCING_RE = re.compile(r"^\s*introducing\b", re.IGNORECASE)

SYSTEM_PROMPT = (
    "You are a brand copywriter known for voice that feels like a real "
    "human wrote it. You avoid corporate language, exclamation points, "
    "and the word 'revolutionary'. You favor short sentences."
)


def _scan_examples(examples: list[str]) -> None:
    for ex in examples:
        if "!" in ex:
            raise ValueError(f"example contains exclamation point: {ex!r}")
        if INTRODUCING_RE.search(ex):
            raise ValueError(f"example uses banned 'Introducing...' opener: {ex!r}")
        match = BAN_RE.search(ex)
        if match:
            raise ValueError(
                f"example contains banned word {match.group(0)!r}: {ex!r}"
            )


def _strip_trailing_punct(text: str) -> str:
    return re.sub(r"[.!?]+\s*$", "", text).strip()


def _validate(parsed: dict[str, Any]) -> Voice:
    tone = str(parsed.get("tone", "")).strip()
    do = parsed.get("do", [])
    dont = parsed.get("dont", [])
    examples = parsed.get("examples", [])

    if not tone:
        raise ValueError("tone is required")
    if not isinstance(do, list) or len(do) != 3:
        raise ValueError("do must be a list of exactly 3 items")
    if not isinstance(dont, list) or len(dont) != 3:
        raise ValueError("dont must be a list of exactly 3 items")
    if not isinstance(examples, list) or len(examples) != 3:
        raise ValueError("examples must be a list of exactly 3 items")

    def _unwrap(x: Any) -> str:
        """Claude sometimes returns {"tagline": "..."} objects instead of strings."""
        if isinstance(x, dict):
            return str(next(iter(x.values()), "")).strip()
        return str(x).strip()

    do_clean = [_unwrap(x) for x in do]
    dont_clean = [_unwrap(x) for x in dont]
    examples_clean = [_unwrap(x) for x in examples]
    _scan_examples(examples_clean)

    examples_clean[0] = _strip_trailing_punct(examples_clean[0])

    return Voice(tone=tone, do=do_clean, dont=dont_clean, examples=examples_clean)


def _fallback_voice(brand_name: str, product_idea: str, persona: Persona) -> Voice:
    return Voice(
        tone="dry, observational, never tries too hard",
        do=[
            "use lowercase by default",
            "favor short sentences over clauses",
            "name the product by what it actually does",
        ],
        dont=[
            "never use exclamation points",
            "never open with 'Introducing'",
            "avoid corporate boilerplate",
        ],
        examples=[
            f"{brand_name.lower()}, made small",
            f"a quiet take on {product_idea.lower() or 'the everyday object'}",
            f"new from {brand_name.lower()}. small batch. limited drop.",
        ],
    )


async def generate_voice(
    brand_name: str, product_idea: str, persona: Persona
) -> Voice:
    """Generate brand voice spec. Strips trailing punctuation from tagline."""
    client = get_openai_client()
    if client is None:
        logger.info("generate_voice: no OpenAI key, using fixture")
        return _fallback_voice(brand_name, product_idea, persona)

    user = (
        f"Define the voice for '{brand_name}' that makes:\n{product_idea}\n\n"
        f"Customer: {persona.summary}\n"
        f"Voice traits to embody: {persona.voice_traits}\n\n"
        'Return JSON: {"tone": "...", "do": [...3...], "dont": [...3...], '
        '"examples": [tagline (max 6 words, no punctuation), '
        'product card (1 sentence, max 20 words), '
        'social caption (max 30 words)]}\n\n'
        f"BANNED in all examples: {', '.join(BANNED_WORDS)}. "
        "No exclamation points. No 'Introducing...' openers."
    )
    try:
        return await call_json_mode(
            client=client,
            system=SYSTEM_PROMPT,
            user=user,
            validator=_validate,
            temperature=0.95,
            repair_hint=(
                "Rewrite examples without that word. Replace it with something "
                "specific and concrete."
            ),
        )
    except ValueError as err:
        logger.warning("voice retry exhausted (%s); using fallback", err)
        return _fallback_voice(brand_name, product_idea, persona)
