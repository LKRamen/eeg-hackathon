from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

import numpy as np
from openai import AsyncOpenAI

from ..config import get_settings
from ..models.schemas import AgencyMatch, Persona

logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

# Module-level cache: agency_id -> (agency_dict, embedding_vector)
_agency_cache: dict[str, tuple[dict, np.ndarray]] = {}


def _load_agencies() -> list[dict]:
    path = FIXTURES_DIR / "agencies.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _agency_text(agency: dict) -> str:
    tags = agency.get("specialty_tags", []) + agency.get("aesthetic_tags", [])
    return f"{', '.join(tags)}. {agency['blurb']}"


def _persona_text(persona: Persona) -> str:
    terms = (
        persona.aesthetic_keywords
        + persona.interests
        + persona.purchase_signals
    )
    return ", ".join(terms)


def _cosine(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def _rescale(cosine: float) -> float:
    """Map cosine similarity [0.3, 0.6] -> confidence score [60, 99]."""
    score = 60.0 + (cosine - 0.3) / 0.3 * 39.0
    return round(max(60.0, min(99.0, score)), 1)


async def _get_embedding(client: AsyncOpenAI, text: str) -> np.ndarray:
    resp = await client.embeddings.create(
        model="text-embedding-ada-002",
        input=text,
    )
    return np.array(resp.data[0].embedding, dtype=np.float32)


async def _ensure_agency_embeddings(client: AsyncOpenAI) -> None:
    if _agency_cache:
        return
    agencies = _load_agencies()
    logger.info("Computing embeddings for %d agencies", len(agencies))
    for agency in agencies:
        text = _agency_text(agency)
        vector = await _get_embedding(client, text)
        _agency_cache[agency["id"]] = (agency, vector)
    logger.info("Agency embeddings ready")


async def _why_line(
    client: AsyncOpenAI,
    agency: dict[str, Any],
    persona: Persona,
    overlap_tags: set[str],
) -> str:
    overlap_str = ", ".join(overlap_tags) if overlap_tags else "visual and tonal alignment"
    prompt = (
        f"Why does this agency match this customer? In under 20 words, be specific.\n\n"
        f"AGENCY: {agency['name']} — {agency['blurb']}\n"
        f"CUSTOMER: {persona.summary}\n"
        f"AESTHETIC OVERLAP: {overlap_str}"
    )
    resp = await client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.4,
        max_tokens=60,
    )
    return resp.choices[0].message.content.strip().rstrip(".")


async def match(persona: Persona) -> list[AgencyMatch]:
    settings = get_settings()
    client = AsyncOpenAI(api_key=settings.openai_api_key)

    await _ensure_agency_embeddings(client)

    persona_vec = await _get_embedding(client, _persona_text(persona))

    # Score all agencies
    scored: list[tuple[float, dict, np.ndarray]] = []
    for agency, vec in _agency_cache.values():
        sim = _cosine(persona_vec, vec)
        scored.append((sim, agency, vec))

    scored.sort(key=lambda x: x[0], reverse=True)
    top3 = scored[:3]

    matches: list[AgencyMatch] = []
    for cosine_score, agency, _ in top3:
        overlap = set(persona.aesthetic_keywords) & set(agency.get("aesthetic_tags", []))
        why = await _why_line(client, agency, persona, overlap)

        matches.append(
            AgencyMatch(
                id=agency["id"],
                name=agency["name"],
                blurb=agency["blurb"],
                specialty_tags=agency.get("specialty_tags", []),
                aesthetic_tags=agency.get("aesthetic_tags", []),
                notable_clients=agency.get("notable_clients", []),
                min_budget=agency.get("min_budget", ""),
                website=agency.get("website", ""),
                match_score=_rescale(cosine_score),
                why=why,
            )
        )

    return matches
