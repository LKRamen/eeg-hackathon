from __future__ import annotations

"""Influencer matching service.

Uses Claude to generate a list of 6 ideal creator profiles for the brand,
derived entirely from the scraped persona. No external influencer API needed.

Each match includes handle archetype, platform, niche, follower tier,
why they fit, content style, estimated reach, and collab angle.
"""

import json
import logging
import re

from ..models.schemas import InfluencerMatch, Persona
from ._openai_client import get_openai_client

log = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = (
    "You are a talent and influencer strategy director at a top creative agency. "
    "You match brands with the exact right creators — not generic suggestions, "
    "but specific archetypes of real people who would authentically post about this brand. "
    "You know the difference between a nano creator who converts and a macro one who doesn't."
)


def _fallback(persona: Persona, product_idea: str) -> list[InfluencerMatch]:
    kw = persona.aesthetic_keywords[0] if persona.aesthetic_keywords else "minimal"
    interest = persona.interests[0] if persona.interests else product_idea
    return [
        InfluencerMatch(
            handle=f"@{kw.split()[0].lower()}_studio",
            platform="instagram",
            niche=interest,
            follower_tier="micro (10K–100K)",
            why=f"Their audience overlaps directly with {persona.name or 'your target customer'}",
            content_style="aesthetic product photography, editorial flat lays",
            estimated_reach="~30K avg impressions/post",
            collab_angle="gifting + affiliate link",
        )
    ]


async def find_influencers(
    persona: Persona,
    product_idea: str,
    brand_name: str,
    count: int = 6,
) -> list[InfluencerMatch]:
    client = get_openai_client()
    if client is None:
        log.info("find_influencers: no Anthropic key, using fallback")
        return _fallback(persona, product_idea)

    prompt = f"""Brand: {brand_name}
Product: {product_idea}
Target customer: {persona.summary}
Aesthetic: {', '.join(persona.aesthetic_keywords[:4])}
Interests: {', '.join(persona.interests[:4])}
Voice traits: {', '.join(persona.voice_traits[:3])}
Purchase signals: {', '.join(persona.purchase_signals[:2])}

Find {count} ideal influencer/creator profiles to partner with for this brand launch.
Be specific — name real-feeling handle archetypes (e.g. @thriftedrunway, @minimalistdad),
real niches, real content styles. Mix platforms and follower tiers strategically.

Return a JSON array of {count} objects:
[
  {{
    "handle": "@handle_example",
    "platform": "instagram" | "tiktok" | "youtube",
    "niche": "specific niche in 3-5 words",
    "follower_tier": "nano (1K–10K)" | "micro (10K–100K)" | "macro (100K–1M)",
    "why": "one sentence — specific reason tied to this brand and persona",
    "content_style": "2-3 content formats they use",
    "estimated_reach": "~XK avg impressions/post",
    "collab_angle": "gifting" | "paid post" | "affiliate" | "co-design" | "ambassador"
  }}
]

Only return the JSON array, no other text."""

    try:
        resp = await client.messages.create(
            model=_MODEL,
            max_tokens=1500,
            system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        # Strip markdown fences if present
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        data = json.loads(raw)
        matches = []
        for item in data[:count]:
            matches.append(InfluencerMatch(
                handle=item.get("handle", "@creator"),
                platform=item.get("platform", "instagram"),
                niche=item.get("niche", "lifestyle"),
                follower_tier=item.get("follower_tier", "micro (10K–100K)"),
                why=item.get("why", ""),
                content_style=item.get("content_style", ""),
                estimated_reach=item.get("estimated_reach", ""),
                collab_angle=item.get("collab_angle", "gifting"),
            ))
        log.info("find_influencers: generated %d matches for %s", len(matches), brand_name)
        return matches
    except Exception as exc:
        log.warning("find_influencers failed (%s), using fallback", exc)
        return _fallback(persona, product_idea)
