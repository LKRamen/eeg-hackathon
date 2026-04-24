"""Stub for Person 2's matching.match.

Replace `from apps.api.services._matching_stub import match` with the real
Person 2 module once it lands.
"""

from __future__ import annotations

from apps.api.models.schemas import AgencyMatch, Persona


_FIXTURES: tuple[AgencyMatch, ...] = (
    AgencyMatch(
        id="agency-quiet",
        name="Studio Quiet",
        blurb="Independent brand studio for considered makers.",
        specialty_tags=["brand identity", "packaging", "art direction"],
        aesthetic_tags=["minimal", "considered", "monochrome"],
        notable_clients=["Ferment", "Plot"],
        min_budget="$15k",
        website="https://studioquiet.com",
        match_score=0.86,
        why="Aesthetic overlap on brutalist + minimal; both work in a quiet, considered register.",
    ),
    AgencyMatch(
        id="agency-bright",
        name="Bright Office",
        blurb="A small studio that makes brands feel like a single voice.",
        specialty_tags=["brand identity", "web", "type"],
        aesthetic_tags=["clean", "warm", "type-led"],
        notable_clients=["Verge", "Slow Tools"],
        min_budget="$25k",
        website="https://brightoffice.studio",
        match_score=0.74,
        why="Strong typography practice; aligns with persona voice traits.",
    ),
    AgencyMatch(
        id="agency-monolith",
        name="Monolith",
        blurb="Identity studio working across print + product.",
        specialty_tags=["packaging", "industrial design", "identity"],
        aesthetic_tags=["brutalist", "concrete", "raw"],
        notable_clients=["Edge Foundry", "North Quarter"],
        min_budget="$30k",
        website="https://monolith.design",
        match_score=0.62,
        why="Aesthetic match on brutalist concrete language.",
    ),
)


async def match(persona: Persona) -> list[AgencyMatch]:
    """Return a ranked list of agency matches for the persona."""
    return list(_FIXTURES)
