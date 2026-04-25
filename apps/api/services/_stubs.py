from __future__ import annotations

import asyncio
import json
import random
from pathlib import Path

from ..models.schemas import (
    AgencyMatch,
    BrandAssets,
    Color,
    FontSpec,
    Mockup,
    Persona,
    RawAudience,
    Typography,
    Voice,
)

_FIXTURES = Path(__file__).parent.parent / "fixtures"


def _sleep() -> float:
    return random.uniform(1.5, 3.0)


class _Scraper:
    async def scrape(self, handle: str) -> RawAudience:
        await asyncio.sleep(_sleep())
        with open(_FIXTURES / "sample_audience.json", encoding="utf-8") as f:
            data = json.load(f)
        return RawAudience.model_validate(data)


class _PersonaSvc:
    async def synthesize(self, product_idea: str, audience: RawAudience) -> Persona:
        await asyncio.sleep(_sleep())
        with open(_FIXTURES / "sample_persona.json", encoding="utf-8") as f:
            data = json.load(f)
        return Persona.model_validate(data)


class _Brand:
    async def assemble(self, persona: Persona, product_idea: str) -> BrandAssets:
        await asyncio.sleep(_sleep())
        return BrandAssets(
            brand_name="Vøid",
            tagline="Built for those who move.",
            logo_url="https://placehold.co/1024x1024/000/fff?text=Logo",
            palette=[
                Color(hex="#0a0a0a", role="bg", name="Void Black"),
                Color(hex="#f5f5f0", role="fg", name="Bone White"),
                Color(hex="#c8ff00", role="primary", name="Volt"),
                Color(hex="#3a3a3a", role="secondary", name="Concrete"),
                Color(hex="#ff3c00", role="accent", name="Signal Red"),
            ],
            typography=Typography(
                display=FontSpec(
                    family="Space Grotesk",
                    google_url="https://fonts.google.com/specimen/Space+Grotesk",
                ),
                body=FontSpec(
                    family="Inter",
                    google_url="https://fonts.google.com/specimen/Inter",
                ),
            ),
            voice=Voice(
                tone="Deadpan and direct. No fluff.",
                do=[
                    "Say less, mean more",
                    "Reference the culture without explaining it",
                    "Let the product speak for itself",
                ],
                dont=[
                    "Use buzzwords like 'premium' or 'elevated'",
                    "Over-explain anything",
                    "Sound like an ad",
                ],
                examples=[
                    "water, but make it yours.",
                    "we didn't reinvent the bottle. we just made one worth keeping.",
                    "carry less. drink more.",
                ],
            ),
            mockups=[
                Mockup(
                    label="tee",
                    url="https://placehold.co/800x800/1a1a1a/c8ff00?text=Tee",
                ),
                Mockup(
                    label="tote",
                    url="https://placehold.co/800x800/1a1a1a/c8ff00?text=Tote",
                ),
            ],
        )


class _Matching:
    async def match(self, persona: Persona) -> list[AgencyMatch]:
        await asyncio.sleep(_sleep())
        return [
            AgencyMatch(
                agency_id="ag_01",
                name="Studio Quiet",
                blurb="Boutique brand studio specializing in utilitarian streetwear and independent labels. Known for restrained art direction that trusts the product.",
                specialty_tags=["streetwear", "apparel", "brand identity"],
                match_score=0.94,
                why="Their anti-hype aesthetic and NYC roots align directly with Jordan's audience.",
            ),
            AgencyMatch(
                agency_id="ag_02",
                name="Meridian Collective",
                blurb="Cross-disciplinary studio from Bushwick. They build brand systems for founders who come from the culture, not the MBA program.",
                specialty_tags=["brand systems", "packaging", "sustainable brands"],
                match_score=0.87,
                why="Strong fit on sustainability positioning and community-first brand voice.",
            ),
            AgencyMatch(
                agency_id="ag_03",
                name="Offcut Studio",
                blurb="Specialists in archive-adjacent aesthetics. Clients include independent footwear labels and Japanese casualwear importers.",
                specialty_tags=["archive fashion", "editorial", "Japan-market"],
                match_score=0.81,
                why="Deep fluency in the archive and vintage language Jordan's audience speaks.",
            ),
        ]


class _Export:
    async def build_pdf(self, brand: BrandAssets, persona: Persona) -> str:
        await asyncio.sleep(_sleep())
        return "https://placehold.co/brand-guide.pdf"


scraper = _Scraper()
persona_svc = _PersonaSvc()
brand = _Brand()
matching = _Matching()
export = _Export()
