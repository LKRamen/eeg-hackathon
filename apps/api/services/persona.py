from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from config import get_settings
from models.schemas import Persona, RawAudience

logger = logging.getLogger(__name__)

_BANNED_PHRASES = [
    "tech-savvy",
    "values authenticity",
    "discerning consumer",
    "discerning",
    "ambitious professional",
    "passionate about quality",
    "authentic",
    "They are ",
]

_SYSTEM_PROMPT = """\
You are a brand strategist who builds vivid, specific customer personas from social \
audience signals. You avoid generic demographic descriptions. You ground every claim \
in the data provided. You write the way a sharp editorial writer does — concrete nouns, \
no corporate filler.

BANNED PHRASES — never write these:
- "tech-savvy"
- "values authenticity" or any form of "authentic"
- "discerning consumer" or "discerning"
- "ambitious" or "ambitious professional"
- "passionate about quality"
- Any sentence starting with "They are..."

Instead: name a specific subreddit, magazine, brand, ritual, or third-place. \
Force yourself to be embarrassingly specific. A persona that names a specific \
subreddit is worth 10 that say "values community".\
"""

_USER_PROMPT_TEMPLATE = """\
PRODUCT IDEA: {product_idea}

CREATOR'S AUDIENCE (signals only — the persona is the *audience member*, not the creator):
  Bio: {bio}
  Follower count: {follower_count}
  Top hashtags: {top_hashtags}
  Frequently mentioned accounts: {mentioned_accounts}
  Recent post captions (sample of 10):
{captions}

Synthesize the primary customer persona who would buy this product from this creator. \
Return JSON with this exact schema:
{{
  "name": "first name only, evocative — not 'John' or 'Sarah'. Pick something that fits the cultural register.",
  "age_range": "tight 4-6 year range, e.g. '24-29'",
  "location_archetype": "where this person lives — archetypal not literal. Example: 'second-tier creative cities — Lisbon, Mexico City, Brooklyn'",
  "psychographics": ["3-5 short phrases capturing values, beliefs, lifestyle — specific enough to name a subreddit or magazine"],
  "interests": ["5-8 specific interests — not 'music', say 'minimalist techno' or 'natural wine bars'"],
  "purchase_signals": ["3-4 concrete things they actually spend money on that signal they'd buy this product"],
  "aesthetic_keywords": ["EXACTLY 5 visual words fed to an image generator. Be visual and specific: 'matte black, brutalist concrete, Tokyo neon, raw edges, monospace type'. Not 'modern' or 'clean'."],
  "voice_traits": ["3 adjectives for how a brand should speak to them"],
  "summary": "exactly 2 sentences. Vivid. Specific. Reference a cultural touchpoint when supported by the data. Start the first sentence with a concrete behavior, not an adjective. No corporate speak."
}}\
"""


def _build_user_prompt(product_idea: str, audience: RawAudience) -> str:
    captions = "\n".join(
        f'    - "{p.caption[:200]}"'
        for p in audience.posts[:10]
        if p.caption
    )
    return _USER_PROMPT_TEMPLATE.format(
        product_idea=product_idea,
        bio=audience.bio,
        follower_count=audience.follower_count,
        top_hashtags=", ".join(audience.top_hashtags),
        mentioned_accounts=", ".join(audience.top_mentioned_accounts),
        captions=captions,
    )


def _contains_banned(text: str) -> bool:
    lower = text.lower()
    return any(p.lower() in lower for p in _BANNED_PHRASES)


async def synthesize(product_idea: str, audience: RawAudience) -> Persona:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    user_prompt = _build_user_prompt(product_idea, audience)

    async def _call(extra: str = "") -> dict:
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt + extra},
        ]
        resp = await client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.8,
        )
        return json.loads(resp.choices[0].message.content)

    try:
        data = await _call()
        persona = Persona(**data)
    except Exception as exc:
        logger.warning("First persona attempt failed (%s), retrying", exc)
        data = await _call(
            "\n\nYour previous response was not valid JSON matching the schema. "
            "Return valid JSON only, no preamble."
        )
        persona = Persona(**data)

    # Warn if banned phrases sneak through — helpful during iteration
    full_text = persona.model_dump_json()
    if _contains_banned(full_text):
        logger.warning("Persona contains banned phrases — consider iterating the prompt")

    return persona


_BRAND_NAME_SYSTEM = """\
You are a naming consultant with taste. You create brand names that feel discovered, \
not invented. You avoid portmanteaus, -ly suffixes, dropped vowels, and anything \
that sounds like a Y Combinator company. The best names are short, slightly strange, \
and immediately visual.\
"""

_BRAND_NAME_USER_TEMPLATE = """\
Suggest 5 brand name options for this product.

PRODUCT: {product_idea}
CUSTOMER PERSONA: {summary}
AESTHETIC: {aesthetic}

Names must be:
- 1-2 syllables, easy to pronounce and spell
- Not the name of an existing major brand in this category
- Evocative of the aesthetic, not literal
- Available as a .com or close (don't verify, just aim for unusual combinations)
- Memorable — the kind of name that gets tattooed on forearms or painted on vans

Return JSON: {{"options": ["name1", "name2", "name3", "name4", "name5"], "recommended": "name", "why": "one sentence"}}\
"""


async def suggest_brand_name(
    product_idea: str, persona: Persona
) -> tuple[list[str], str]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    prompt = _BRAND_NAME_USER_TEMPLATE.format(
        product_idea=product_idea,
        summary=persona.summary,
        aesthetic=", ".join(persona.aesthetic_keywords),
    )

    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": _BRAND_NAME_SYSTEM},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
        temperature=0.9,
    )

    data = json.loads(resp.choices[0].message.content)
    options: list[str] = data["options"]
    recommended: str = data["recommended"]
    logger.info("Brand names: %s (recommended: %s)", options, recommended)
    return options, recommended
