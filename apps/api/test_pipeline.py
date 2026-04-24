#!/usr/bin/env python3
"""
Quick end-to-end pipeline test.

Usage:
    python test_pipeline.py <handle> "<product idea>" [--platform x|instagram]

Examples:
    python test_pipeline.py yourhandle "your product idea"
    python test_pipeline.py yourhandle "matcha drink" --platform instagram
    python test_pipeline.py paulg "indie SaaS tool" --platform x
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

# Make sure we can import from apps/api
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

from services.scraper import scrape
from services.persona import analyze_network, suggest_brand_name, synthesize


def section(title: str) -> None:
    print(f"\n{'─' * 50}")
    print(f"  {title}")
    print(f"{'─' * 50}")


async def run(handle: str, product_idea: str, platform: str = "x") -> None:
    # ── Step 1: Scrape ──────────────────────────────────
    section(f"1. Scraping @{handle} on {platform}")
    try:
        audience = await scrape(handle, platform=platform)
    except Exception as e:
        print(f"  ✗ {e}")
        sys.exit(1)
    print(f"  Bio:       {audience.bio[:80] or '(empty)'}")
    print(f"  Followers: {audience.follower_count:,}")
    print(f"  Posts:     {len(audience.posts)}")
    print(f"  Followers sampled: {len(audience.followers_sample)}")
    print(f"  Following sampled: {len(audience.following_sample)}")
    print(f"  Top hashtags: {', '.join(audience.top_hashtags[:5]) or '(none)'}")

    # ── Step 2: Network insights ─────────────────────────
    section("2. Analyzing follower/following network")
    insights = await analyze_network(handle, audience)
    print(f"\n  Audience archetypes:")
    for a in insights.audience_archetypes:
        print(f"    • {a}")
    print(f"\n  Common interests: {', '.join(insights.common_interests)}")
    print(f"\n  Content pillars:")
    for p in insights.content_pillars:
        print(f"    • {p}")
    print(f"\n  Push targets:")
    for t in insights.push_targets:
        print(f"    → {t}")
    print(f"\n  Brand voice match: {insights.brand_voice_match}")
    print(f"\n  Network summary: {insights.network_summary}")

    # ── Step 3: Persona synthesis ────────────────────────
    section(f"3. Synthesizing brand persona for: \"{product_idea}\"")
    persona = await synthesize(product_idea, audience)
    print(f"\n  Persona name:    {persona.name}")
    print(f"  Age range:       {persona.age_range}")
    print(f"  Location:        {persona.location_archetype}")
    print(f"  Psychographics:  {', '.join(persona.psychographics)}")
    print(f"  Interests:       {', '.join(persona.interests)}")
    print(f"  Purchase signals: {', '.join(persona.purchase_signals)}")
    print(f"  Aesthetic:       {', '.join(persona.aesthetic_keywords)}")
    print(f"  Voice traits:    {', '.join(persona.voice_traits)}")
    print(f"\n  Summary: {persona.summary}")

    # ── Step 4: Brand name suggestions ───────────────────
    section("4. Brand name suggestions")
    options, recommended = await suggest_brand_name(product_idea, persona)
    print(f"\n  Options: {', '.join(options)}")
    print(f"  Recommended: ★ {recommended}")

    # ── Save full output ─────────────────────────────────
    output_path = Path(__file__).parent / "cache" / f"{handle}_pipeline_result.json"
    output_path.parent.mkdir(exist_ok=True)
    output_path.write_text(json.dumps({
        "handle": handle,
        "product_idea": product_idea,
        "network_insights": insights.model_dump(),
        "persona": persona.model_dump(),
        "brand_names": {"options": options, "recommended": recommended},
    }, indent=2))

    section(f"Done — full output saved to cache/{handle}_pipeline_result.json")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    handle = sys.argv[1].lstrip("@")
    product_idea = sys.argv[2] if len(sys.argv) > 2 else "personal brand"
    platform = "instagram" if "--platform" in sys.argv and sys.argv[sys.argv.index("--platform") + 1] == "instagram" else "x"

    asyncio.run(run(handle, product_idea, platform))
