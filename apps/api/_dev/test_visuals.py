"""Inner-loop test for visual asset generation.

Run from apps/api/:
  python _dev/test_visuals.py

Outputs are saved to /tmp/halo_test/ so you can inspect without needing Supabase.
Supabase upload is skipped if SUPABASE_URL is unset.
"""

from __future__ import annotations

import asyncio
import io
import os
import sys
from pathlib import Path

# Ensure apps/api is on the path when run directly
sys.path.insert(0, str(Path(__file__).parent.parent))

from models.schemas import Persona
from services.images import generate_logo_set, generate_mockups, generate_social_kit

OUT_DIR = Path("/tmp/halo_test")
OUT_DIR.mkdir(parents=True, exist_ok=True)

TEST_PERSONA = Persona(
    name="Mio",
    age_range="24-29",
    location_archetype="Brooklyn, Lisbon, Mexico City",
    psychographics=["values craft over hype", "anti-algorithm", "early adopter"],
    interests=["natural wine", "minimalist techno", "specialty coffee", "analogue photography"],
    purchase_signals=["small-batch coffee", "limited run clothing", "design-forward tools"],
    aesthetic_keywords=["matte black", "brutalist concrete", "Tokyo neon", "raw edges", "monospace type"],
    voice_traits=["dry", "observational", "knowing"],
    summary=(
        "Mio moves between creative cities collecting references. "
        "She buys for quality and story, not trend."
    ),
)

TEST_BRAND_NAME = "Hush"
TEST_PRODUCT = "matcha energy drink for late-night creatives"
TEST_JOB_ID = "test-job-001"
TEST_COLOR = "#0a0a0a"
TEST_TAGLINE = "Don't sleep on it."


async def main() -> None:
    print("=== Logo set ===")
    logos = await generate_logo_set(
        TEST_BRAND_NAME, TEST_PRODUCT, TEST_PERSONA, TEST_COLOR, TEST_JOB_ID
    )
    print(logos.model_dump_json(indent=2))

    print("\n=== Mockups (tee + tote) ===")
    mockups = await generate_mockups(TEST_BRAND_NAME, TEST_PERSONA, TEST_JOB_ID)
    for m in mockups:
        print(f"  {m.label}: {m.url}")

    print("\n=== Social kit ===")
    social = await generate_social_kit(
        TEST_BRAND_NAME,
        TEST_TAGLINE,
        TEST_PERSONA,
        logos.mono_dark,
        TEST_COLOR,
        TEST_JOB_ID,
    )
    for s in social:
        print(f"  {s.label} ({s.format}): {s.url}")

    print(f"\nDone. Check {OUT_DIR} for any locally saved assets.")


if __name__ == "__main__":
    asyncio.run(main())
