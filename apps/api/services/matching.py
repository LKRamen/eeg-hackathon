from __future__ import annotations

import asyncio
import json
import logging
import re
from pathlib import Path
from typing import Any

from anthropic import AsyncAnthropic

from ..models.schemas import AgencyMatch, Persona
from ._openai_client import get_claude_client

MODEL = "claude-haiku-4-5-20251001"

logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"

# Module-level cache: agency_id -> agency_dict
_agency_cache: dict[str, dict] = {}


def _load_agencies() -> list[dict]:
    path = FIXTURES_DIR / "agencies.json"
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _agency_terms(agency: dict) -> set[str]:
    """All lowercase words from tags + blurb."""
    tags = agency.get("specialty_tags", []) + agency.get("aesthetic_tags", [])
    words = set()
    for t in tags:
        words.update(re.findall(r"[a-z]+", t.lower()))
    for w in re.findall(r"[a-z]+", agency.get("blurb", "").lower()):
        words.add(w)
    return words


def _persona_terms(persona: Persona) -> set[str]:
    """All lowercase words from persona signals."""
    terms = (
        persona.aesthetic_keywords
        + persona.interests
        + persona.purchase_signals
        + persona.psychographics
    )
    words = set()
    for t in terms:
        words.update(re.findall(r"[a-z]+", t.lower()))
    return words


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _tag_overlap_score(agency: dict, persona_terms: set[str]) -> float:
    """
    Weighted score:
    - 60% Jaccard over all agency terms vs persona terms
    - 40% direct tag hit rate (how many aesthetic/specialty tags appear verbatim in persona)
    """
    agency_terms = _agency_terms(agency)
    jaccard = _jaccard(agency_terms, persona_terms)

    direct_tags = agency.get("specialty_tags", []) + agency.get("aesthetic_tags", [])
    if direct_tags:
        hits = sum(
            1 for t in direct_tags
            if any(w in persona_terms for w in re.findall(r"[a-z]+", t.lower()))
        )
        tag_rate = hits / len(direct_tags)
    else:
        tag_rate = 0.0

    return 0.6 * jaccard + 0.4 * tag_rate


def _rescale(raw: float) -> float:
    """Map raw overlap score [0, 0.5] -> confidence [60, 99]."""
    score = 60.0 + (raw / 0.5) * 39.0
    return round(max(60.0, min(99.0, score)), 1)


def _ensure_agency_cache() -> None:
    if _agency_cache:
        return
    agencies = _load_agencies()
    logger.info("Loaded %d agencies for keyword matching", len(agencies))
    for agency in agencies:
        _agency_cache[agency["id"]] = agency


def _why_line_template(agency: dict[str, Any], overlap_tags: set[str]) -> str:
    tags = list(overlap_tags)[:2] if overlap_tags else agency.get("specialty_tags", [])[:2]
    tag_str = " and ".join(tags) if tags else "their aesthetic"
    return f"Strong fit on {tag_str} — aligns with the brand's visual direction"


async def _why_line(
    client: AsyncAnthropic | None,
    agency: dict[str, Any],
    persona: Persona,
    overlap_tags: set[str],
) -> str:
    if client is None:
        return _why_line_template(agency, overlap_tags)
    overlap_str = ", ".join(overlap_tags) if overlap_tags else "visual and tonal alignment"
    prompt = (
        f"Why does this agency match this customer? In under 20 words, be specific.\n\n"
        f"AGENCY: {agency['name']} — {agency['blurb']}\n"
        f"CUSTOMER: {persona.summary}\n"
        f"AESTHETIC OVERLAP: {overlap_str}"
    )
    try:
        resp = await client.messages.create(
            model=MODEL,
            max_tokens=60,
            temperature=0.4,
            messages=[{"role": "user", "content": prompt}],
        )
        return resp.content[0].text.strip().rstrip(".")
    except Exception as exc:
        logger.warning("_why_line failed (%s) — using template", exc)
        return _why_line_template(agency, overlap_tags)


async def match(persona: Persona) -> list[AgencyMatch]:
    client = get_claude_client()

    _ensure_agency_cache()

    persona_terms = _persona_terms(persona)

    scored: list[tuple[float, dict]] = sorted(
        ((_tag_overlap_score(a, persona_terms), a) for a in _agency_cache.values()),
        key=lambda x: x[0],
        reverse=True,
    )
    top3 = scored[:3]

    overlaps = [
        set(persona.aesthetic_keywords) & set(agency.get("aesthetic_tags", []))
        for _, agency in top3
    ]
    why_lines = await asyncio.gather(*[
        _why_line(client, agency, persona, overlap)
        for (_, agency), overlap in zip(top3, overlaps)
    ])

    return [
        AgencyMatch(
            agency_id=agency["id"],
            name=agency["name"],
            blurb=agency["blurb"],
            specialty_tags=agency.get("specialty_tags", []),
            aesthetic_tags=agency.get("aesthetic_tags", []),
            notable_clients=agency.get("notable_clients", []),
            min_budget=agency.get("min_budget", ""),
            website=agency.get("website", ""),
            match_score=_rescale(raw_score),
            why=why,
        )
        for (raw_score, agency), why in zip(top3, why_lines)
    ]
