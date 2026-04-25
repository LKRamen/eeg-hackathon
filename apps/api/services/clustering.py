from __future__ import annotations

"""Audience interest clustering.

Two modes (selected automatically):
  1. Zero-shot via GPT-4o   — default; no training data needed.
  2. Embedding similarity   — uses OpenAI text-embedding-3-small to compare
                              audience interests against predefined cluster
                              centroids. Falls back to GPT-4o on any error.

Output is a dict of cluster_name → confidence (0.0–1.0), sorted descending.
Top 3 clusters are attached to the Persona and used by the brand + matching
services to make targeting decisions more specific.
"""

import json
from typing import Any

import numpy as np
from openai import AsyncOpenAI

from ..config import get_settings

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

# Descriptive phrases for embedding-based centroid comparison
_CLUSTER_DESCRIPTIONS: dict[str, str] = {
    "fitness_wellness": "gym workouts, yoga, running, health supplements, biohacking, mental health, meditation",
    "tech_gaming": "software, AI, gadgets, PC gaming, esports, startups, developer tools",
    "fashion_streetwear": "sneakers, limited drops, luxury brands, vintage thrift, streetwear, runway",
    "food_beverage": "specialty coffee, natural wine, restaurant culture, food photography, craft beverages",
    "art_design": "graphic design, illustration, fine art, galleries, typography, creative tools",
    "music_entertainment": "concerts, music production, vinyl, DJ culture, podcasts, film, TV",
    "travel_outdoor": "travel photography, hiking, van life, surf, adventure sports, national parks",
    "entrepreneurship_finance": "startups, investing, personal finance, business, side hustles, crypto",
    "sustainability_social_impact": "climate, organic living, zero waste, ethical brands, activism, fair trade",
    "sports": "basketball, football, soccer, tennis, cycling, athlete culture",
    "beauty_self_care": "skincare, makeup, haircare, fragrance, wellness routines, spa culture",
    "home_lifestyle": "interior design, minimalism, Scandinavian decor, plants, home cooking",
    "pop_culture_media": "memes, celebrity culture, reality TV, fandom, anime, comic culture",
    "education_self_improvement": "books, online courses, languages, productivity, journaling, life coaching",
}

_client: AsyncOpenAI | None = None


def _openai() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    return _client


# ---------------------------------------------------------------------------
# Zero-shot GPT-4o approach
# ---------------------------------------------------------------------------

async def _cluster_zero_shot(interests: list[str], hashtags: list[str]) -> dict[str, float]:
    cluster_list = "\n".join(f"- {c}" for c in _CLUSTERS)
    signals = interests + hashtags[:10]

    resp = await _openai().chat.completions.create(
        model="gpt-4o",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are an audience analyst. Given a list of interest signals "
                    "from a social media creator's audience, score how strongly that "
                    "audience maps to each interest cluster.\n\n"
                    f"Clusters:\n{cluster_list}\n\n"
                    "Return JSON: {\"scores\": {\"<cluster_name>\": <0.0-1.0>, ...}}\n"
                    "Include ALL clusters. 1.0 = dominant, 0.0 = absent. "
                    "Scores should sum to roughly 2.0–4.0 (audiences span several clusters)."
                ),
            },
            {
                "role": "user",
                "content": f"Interest signals: {json.dumps(signals)}",
            },
        ],
        temperature=0.2,
    )

    body = json.loads(resp.choices[0].message.content or "{}")
    raw: dict[str, Any] = body.get("scores", {})
    scores = {k: float(v) for k, v in raw.items() if k in _CLUSTERS}
    # Fill any missing clusters with 0
    for c in _CLUSTERS:
        scores.setdefault(c, 0.0)
    return dict(sorted(scores.items(), key=lambda kv: kv[1], reverse=True))


# ---------------------------------------------------------------------------
# Embedding similarity approach
# ---------------------------------------------------------------------------

_centroid_cache: dict[str, list[float]] = {}


async def _get_centroids() -> dict[str, list[float]]:
    if _centroid_cache:
        return _centroid_cache

    texts = list(_CLUSTER_DESCRIPTIONS.values())
    names = list(_CLUSTER_DESCRIPTIONS.keys())
    resp = await _openai().embeddings.create(
        model="text-embedding-3-small", input=texts
    )
    for name, item in zip(names, resp.data):
        _centroid_cache[name] = item.embedding

    return _centroid_cache


def _cosine(a: list[float], b: list[float]) -> float:
    va, vb = np.array(a), np.array(b)
    denom = np.linalg.norm(va) * np.linalg.norm(vb)
    return float(np.dot(va, vb) / denom) if denom > 0 else 0.0


async def _cluster_embeddings(interests: list[str], hashtags: list[str]) -> dict[str, float]:
    query = ", ".join(interests + hashtags[:10])
    resp = await _openai().embeddings.create(
        model="text-embedding-3-small", input=[query]
    )
    query_vec = resp.data[0].embedding
    centroids = await _get_centroids()

    raw = {name: _cosine(query_vec, vec) for name, vec in centroids.items()}
    # Rescale to 0–1 relative to the observed range
    lo, hi = min(raw.values()), max(raw.values())
    span = hi - lo or 1.0
    scores = {k: (v - lo) / span for k, v in raw.items()}
    return dict(sorted(scores.items(), key=lambda kv: kv[1], reverse=True))


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def cluster_interests(
    interests: list[str],
    hashtags: list[str],
    *,
    use_embeddings: bool = False,
) -> dict[str, float]:
    """Return cluster → confidence scores, sorted descending.

    Args:
        interests: From Persona.interests (GPT-generated).
        hashtags: From RawAudience.top_hashtags (scraped).
        use_embeddings: If True, use embedding similarity instead of GPT-4o.
                        Embedding approach is cheaper but less nuanced.
    """
    try:
        if use_embeddings:
            return await _cluster_embeddings(interests, hashtags)
        return await _cluster_zero_shot(interests, hashtags)
    except Exception:
        # Embedding fallback if zero-shot fails (and vice versa)
        try:
            if use_embeddings:
                return await _cluster_zero_shot(interests, hashtags)
            return await _cluster_embeddings(interests, hashtags)
        except Exception:
            return {c: 0.0 for c in _CLUSTERS}


def top_clusters(scores: dict[str, float], n: int = 3) -> list[str]:
    """Return the top N cluster names from a scores dict."""
    return [k for k, _ in list(scores.items())[:n]]
