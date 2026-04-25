from __future__ import annotations

"""Audience interest clustering via Claude (zero-shot).

Output is a dict of cluster_name → confidence (0.0–1.0), sorted descending.
Top 3 clusters are attached to the Persona and used by the brand + matching
services to make targeting decisions more specific.
"""

import json
from typing import Any

from anthropic import AsyncAnthropic

from ..config import get_settings

MODEL = "claude-3-5-sonnet-20241022"

_CLUSTERS = [
    "fitness_wellness",
    "tech_gaming",
    "fashion_streetwear",
    "food_beverage",
    "art_design",
    "music_entertainment",
    "travel_outdoor",
    "entrepreneurship_finance",
    "sustainability_social_impact",
    "sports",
    "beauty_self_care",
    "home_lifestyle",
    "pop_culture_media",
    "education_self_improvement",
]

_client: AsyncAnthropic | None = None


def _claude() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    return _client


async def _cluster_zero_shot(interests: list[str], hashtags: list[str]) -> dict[str, float]:
    cluster_list = "\n".join(f"- {c}" for c in _CLUSTERS)
    signals = interests + hashtags[:10]

    system = (
        "You are an audience analyst. Given a list of interest signals "
        "from a social media creator's audience, score how strongly that "
        "audience maps to each interest cluster.\n\n"
        f"Clusters:\n{cluster_list}\n\n"
        'Return JSON: {"scores": {"<cluster_name>": <0.0-1.0>, ...}}\n'
        "Include ALL clusters. 1.0 = dominant, 0.0 = absent. "
        "Scores should sum to roughly 2.0–4.0 (audiences span several clusters).\n\n"
        "Respond with valid JSON only. No preamble, no markdown fences."
    )

    resp = await _claude().messages.create(
        model=MODEL,
        max_tokens=512,
        temperature=0.2,
        system=system,
        messages=[{"role": "user", "content": f"Interest signals: {json.dumps(signals)}"}],
    )

    text = resp.content[0].text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    body = json.loads(text)
    raw: dict[str, Any] = body.get("scores", {})
    scores = {k: float(v) for k, v in raw.items() if k in _CLUSTERS}
    for c in _CLUSTERS:
        scores.setdefault(c, 0.0)
    return dict(sorted(scores.items(), key=lambda kv: kv[1], reverse=True))


async def cluster_interests(
    interests: list[str],
    hashtags: list[str],
    *,
    use_embeddings: bool = False,  # kept for API compat, ignored
) -> dict[str, float]:
    """Return cluster → confidence scores, sorted descending."""
    try:
        return await _cluster_zero_shot(interests, hashtags)
    except Exception:
        return {c: 0.0 for c in _CLUSTERS}


def top_clusters(scores: dict[str, float], n: int = 3) -> list[str]:
    """Return the top N cluster names from a scores dict."""
    return [k for k, _ in list(scores.items())[:n]]
