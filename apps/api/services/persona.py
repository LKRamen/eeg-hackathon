from __future__ import annotations

import json
import logging
from pathlib import Path

from anthropic import AsyncAnthropic

from ..config import get_settings
from ..models.schemas import NetworkInsights, Persona, RawAudience
from ._openai_client import get_claude_client

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"

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
You are a brand strategist who builds vivid, specific brand personas from a person's \
own social presence. You analyze the USER'S OWN posts, bio, and tone to define their \
brand voice and ideal customer — not a generic audience profile. You ground every claim \
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
Force yourself to be embarrassingly specific.

Respond with valid JSON only. No preamble, no markdown fences.\
"""

_USER_PROMPT_TEMPLATE = """\
PRODUCT IDEA: {product_idea}

THIS IS THE USER'S OWN PROFILE — analyze their voice and persona to build their brand:
  Bio: {bio}
  Follower count: {follower_count}
  Top hashtags they use: {top_hashtags}
  Accounts they mention: {mentioned_accounts}
  Their recent posts (sample of 10):
{captions}

Based on how this person writes and what they talk about, synthesize the brand persona \
they embody AND the ideal customer who would buy their product. \
Return JSON with this exact schema:
{{
  "name": "a persona name for their ideal customer — evocative, not 'John' or 'Sarah'",
  "age_range": "tight 4-6 year range, e.g. '24-29'",
  "location_archetype": "archetypal not literal — e.g. 'second-tier creative cities — Lisbon, Mexico City, Brooklyn'",
  "psychographics": ["3-5 short phrases — specific enough to name a subreddit or magazine"],
  "interests": ["5-8 specific interests — not 'music', say 'minimalist techno' or 'natural wine bars'"],
  "purchase_signals": ["3-4 concrete things their ideal customer spends money on"],
  "aesthetic_keywords": ["EXACTLY 5 visual words for an image generator. Specific: 'matte black, brutalist concrete, Tokyo neon, raw edges, monospace type'. Not 'modern' or 'clean'."],
  "voice_traits": ["3 adjectives describing this user's brand voice based on how they actually write"],
  "summary": "exactly 2 sentences. Vivid. Specific. Start with a concrete behavior. No corporate speak."
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


_fixture_cache: Persona | None = None


def _fixture_persona() -> Persona:
    global _fixture_cache
    if _fixture_cache is None:
        fixture = Path(__file__).parent.parent / "fixtures" / "sample_persona.json"
        with open(fixture, encoding="utf-8") as f:
            _fixture_cache = Persona.model_validate(json.load(f))
    return _fixture_cache


async def synthesize(product_idea: str, audience: RawAudience) -> Persona:
    client = get_claude_client()
    if client is None:
        logger.warning("No ANTHROPIC_API_KEY — using fixture persona")
        return _fixture_persona()

    user_prompt = _build_user_prompt(product_idea, audience)

    async def _call(extra: str = "") -> dict:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=2048,
            temperature=0.8,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt + extra}],
        )
        text = resp.content[0].text.strip()
        text = text.lstrip("```json").lstrip("```").rstrip("```").strip()
        return json.loads(text)

    try:
        data = await _call()
        persona = Persona(**data)
    except Exception as exc:
        logger.warning("First persona attempt failed (%s), retrying", exc)
        try:
            data = await _call(
                "\n\nYour previous response was not valid JSON matching the schema. "
                "Return valid JSON only, no preamble, no markdown fences."
            )
            persona = Persona(**data)
        except Exception as exc2:
            logger.warning("Persona synthesis failed after retry (%s) — using fixture", exc2)
            return _fixture_persona()

    full_text = persona.model_dump_json()
    if _contains_banned(full_text):
        logger.warning("Persona contains banned phrases — consider iterating the prompt")

    return persona


_BRAND_NAME_SYSTEM = """\
You are a naming consultant with taste. You create brand names that feel discovered, \
not invented. You avoid portmanteaus, -ly suffixes, dropped vowels, and anything \
that sounds like a Y Combinator company. The best names are short, slightly strange, \
and immediately visual.

Respond with valid JSON only. No preamble, no markdown fences.\
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
    client = AsyncAnthropic(api_key=settings.anthropic_api_key or None)

    prompt = _BRAND_NAME_USER_TEMPLATE.format(
        product_idea=product_idea,
        summary=persona.summary,
        aesthetic=", ".join(persona.aesthetic_keywords),
    )

    resp = await client.messages.create(
        model=MODEL,
        max_tokens=512,
        temperature=0.9,
        system=_BRAND_NAME_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    text = resp.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    data = json.loads(text)
    options: list[str] = data["options"]
    recommended: str = data["recommended"]
    logger.info("Brand names: %s (recommended: %s)", options, recommended)
    return options, recommended


_NETWORK_SYSTEM = """\
You are an audience analyst. Given a sample of bios from someone's Twitter/X \
followers and following, you identify patterns, archetypes, and actionable \
targeting insights. You are specific — you name industries, job titles, \
communities, and cultural references. You never say "diverse audience" or \
"wide range of interests".

Respond with valid JSON only. No preamble, no markdown fences.\
"""

_NETWORK_USER_TEMPLATE = """\
Analyze the network of @{handle} to determine who they should market their brand to.

THEIR BIO: {bio}

SAMPLE FOLLOWER BIOS ({follower_count} followers, showing {sample_size}):
{follower_bios}

SAMPLE FOLLOWING BIOS (showing {following_size}):
{following_bios}

Return JSON with this exact schema:
{{
  "audience_archetypes": ["3-5 specific types of people in this network — e.g. 'indie SaaS founders building in public', 'UX designers at Series A startups'"],
  "common_interests": ["top 6-8 interests that appear across the network bios"],
  "content_pillars": ["4-5 topics this person should post about to resonate with their network"],
  "push_targets": ["3-4 specific audience segments to push the brand to — job titles, communities, platforms"],
  "brand_voice_match": "one sentence: what tone, register, and style lands with this specific network",
  "network_summary": "exactly 2 sentences. Who follows this person and why. Specific — name a platform, publication, or community if the data supports it."
}}\
"""


async def analyze_network(handle: str, audience: RawAudience) -> NetworkInsights:
    """Analyze followers/following to produce audience targeting insights."""
    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key or None)

    follower_bios = "\n".join(
        f"- @{f.username}: {f.bio[:120]}" if f.bio else f"- @{f.username}"
        for f in audience.followers_sample[:60]
    ) or "(no follower data — using post signals only)"

    following_bios = "\n".join(
        f"- @{f.username}: {f.bio[:120]}" if f.bio else f"- @{f.username}"
        for f in audience.following_sample[:40]
    ) or "(no following data)"

    prompt = _NETWORK_USER_TEMPLATE.format(
        handle=handle,
        bio=audience.bio,
        follower_count=audience.follower_count,
        sample_size=len(audience.followers_sample),
        follower_bios=follower_bios,
        following_size=len(audience.following_sample),
        following_bios=following_bios,
    )

    resp = await client.messages.create(
        model=MODEL,
        max_tokens=1024,
        temperature=0.7,
        system=_NETWORK_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )

    text = resp.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    data = json.loads(text)
    return NetworkInsights(**data)
