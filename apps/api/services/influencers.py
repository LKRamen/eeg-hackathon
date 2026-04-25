from __future__ import annotations

"""Influencer matching service.

Finds REAL Instagram accounts by:
1. Claude generates niche hashtags from the persona
2. Instagram hashtag endpoint returns real recent posts + authors
3. We collect real profile data (handle, followers, bio)
4. Claude scores + explains each match against the persona

Falls back to Claude-only archetypes if Instagram cookies are unavailable.
"""

import asyncio
import json
import logging
import re
from typing import Any

from ..models.schemas import InfluencerMatch, Persona
from ._openai_client import get_openai_client

log = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = (
    "You are a talent and influencer strategy director at a top creative agency. "
    "You match brands with the exact right creators — not generic suggestions, "
    "but real people who would authentically post about this brand."
)


# ---------------------------------------------------------------------------
# Step 1: Generate hashtags from persona
# ---------------------------------------------------------------------------

async def _get_hashtags(persona: Persona, product_idea: str, n: int = 6) -> list[str]:
    client = get_openai_client()
    if not client:
        kw = persona.aesthetic_keywords[:3] + persona.interests[:3]
        return [w.split()[0].lower() for w in kw if w][:n]

    prompt = (
        f"Product: {product_idea}\n"
        f"Aesthetic: {', '.join(persona.aesthetic_keywords[:4])}\n"
        f"Interests: {', '.join(persona.interests[:4])}\n\n"
        f"Return a JSON array of {n} Instagram hashtags (no # symbol) that real "
        f"micro-influencers in this niche actually use. Be specific — not #lifestyle, "
        f"but things like #ceramicstudio or #vintagedenim.\n"
        f"Only return the JSON array."
    )
    try:
        resp = await client.messages.create(
            model=_MODEL, max_tokens=200, system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw).rstrip("```").strip()
        tags = json.loads(raw)
        return [t.lstrip("#").strip() for t in tags if t][:n]
    except Exception as exc:
        log.warning("hashtag generation failed (%s)", exc)
        return [w.split()[0].lower() for w in persona.aesthetic_keywords[:n]]


# ---------------------------------------------------------------------------
# Step 2: Fetch real profiles from the user's following list
# ---------------------------------------------------------------------------

def _ig_fetch_profile(username: str, cookies: dict) -> dict | None:
    """Fetch a single Instagram profile. Returns dict or None on failure."""
    import requests
    try:
        session = requests.Session()
        session.cookies.update(cookies)
        session.headers.update({
            "x-ig-app-id": "936619743392459",
            "x-csrftoken": cookies.get("csrftoken", ""),
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
            ),
            "Referer": "https://www.instagram.com/",
        })
        r = session.get(
            "https://www.instagram.com/api/v1/users/web_profile_info/",
            params={"username": username},
            timeout=8,
        )
        r.raise_for_status()
        user = r.json().get("data", {}).get("user") or {}
        if not user:
            return None
        fc = user.get("edge_followed_by", {}).get("count", 0)
        return {
            "handle": f"@{username}",
            "username": username,
            "platform": "instagram",
            "follower_count": fc,
            "bio": user.get("biography", ""),
            "full_name": user.get("full_name", ""),
            "is_verified": user.get("is_verified", False),
        }
    except Exception:
        return None


def _get_ig_cookies() -> dict:
    try:
        import browser_cookie3  # type: ignore
        for loader in (browser_cookie3.chrome, browser_cookie3.firefox):
            try:
                cookies = loader(domain_name=".instagram.com")
                cookie_dict = {c.name: c.value for c in cookies}
                if "sessionid" in cookie_dict:
                    return cookie_dict
            except Exception:
                continue
    except ImportError:
        pass
    return {}


async def _fetch_following_profiles(
    usernames: list[str], target_count: int = 12
) -> list[dict]:
    """Batch-fetch real profiles from a following list, filter to influencer range."""
    cookies = _get_ig_cookies()
    if not cookies:
        log.warning("No Instagram cookies — cannot fetch real profiles")
        return []

    profiles: list[dict] = []
    loop = asyncio.get_event_loop()

    for username in usernames:
        profile = await loop.run_in_executor(None, _ig_fetch_profile, username, cookies)
        if profile and 1_000 <= profile["follower_count"] <= 5_000_000:
            profiles.append(profile)
            log.info("  real influencer found: @%s (%s followers)", username, profile["follower_count"])
        if len(profiles) >= target_count:
            break
        await asyncio.sleep(0.3)  # gentle rate limiting

    return profiles


# ---------------------------------------------------------------------------
# Step 3: Claude scores and explains each real match
# ---------------------------------------------------------------------------

def _tier(followers: int) -> str:
    if followers < 10_000:
        return "nano (1K–10K)"
    if followers < 100_000:
        return "micro (10K–100K)"
    if followers < 1_000_000:
        return "macro (100K–1M)"
    return "mega (1M+)"


def _fmt_followers(n: int) -> str:
    if n >= 1_000_000:
        return f"{n/1_000_000:.1f}M"
    if n >= 1_000:
        return f"{n/1_000:.0f}K"
    return str(n)


async def _score_profiles(
    profiles: list[dict],
    persona: Persona,
    product_idea: str,
    brand_name: str,
    count: int = 6,
) -> list[InfluencerMatch]:
    client = get_openai_client()
    if not client:
        return _profiles_to_matches(profiles[:count])

    profiles_json = json.dumps([
        {
            "handle": p["handle"],
            "followers": _fmt_followers(p["follower_count"]),
            "bio": p["bio"][:120],
            "hashtag": p.get("source_hashtag", ""),
        }
        for p in profiles
    ], indent=2)

    prompt = (
        f"Brand: {brand_name}\n"
        f"Product: {product_idea}\n"
        f"Target customer: {persona.summary}\n"
        f"Aesthetic: {', '.join(persona.aesthetic_keywords[:3])}\n\n"
        f"Here are real Instagram accounts found in relevant hashtags:\n{profiles_json}\n\n"
        f"Pick the best {count} matches. For each, explain WHY they fit this brand specifically.\n\n"
        f"Return a JSON array of {count} objects:\n"
        f'[{{"handle":"@x","niche":"3-5 word niche","why":"1 sentence specific to this brand",'
        f'"content_style":"2-3 formats","estimated_reach":"~XK avg impressions","collab_angle":"gifting|paid post|affiliate|co-design|ambassador"}}]\n'
        f"Only return the JSON array."
    )

    try:
        resp = await client.messages.create(
            model=_MODEL, max_tokens=1200, system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw).rstrip("```").strip()
        scored = json.loads(raw)

        # Merge Claude's scoring with real profile data
        profile_map = {p["handle"]: p for p in profiles}
        matches = []
        for item in scored[:count]:
            handle = item.get("handle", "")
            profile = profile_map.get(handle, {})
            fc = profile.get("follower_count", 0)
            matches.append(InfluencerMatch(
                handle=handle,
                platform=profile.get("platform", "instagram"),
                niche=item.get("niche", "lifestyle"),
                follower_tier=_tier(fc),
                why=item.get("why", ""),
                content_style=item.get("content_style", ""),
                estimated_reach=item.get("estimated_reach", f"~{_fmt_followers(max(fc//20,100))} avg impressions/post"),
                collab_angle=item.get("collab_angle", "gifting"),
            ))
        return matches
    except Exception as exc:
        log.warning("scoring failed (%s) — returning unscored profiles", exc)
        return _profiles_to_matches(profiles[:count])


def _profiles_to_matches(profiles: list[dict]) -> list[InfluencerMatch]:
    """Convert raw profile dicts to InfluencerMatch without Claude scoring."""
    return [
        InfluencerMatch(
            handle=p["handle"],
            platform=p.get("platform", "instagram"),
            niche=p.get("source_hashtag", "lifestyle"),
            follower_tier=_tier(p["follower_count"]),
            why=p.get("bio", "")[:100] or "Found in relevant niche hashtag",
            content_style="lifestyle content",
            estimated_reach=f"~{_fmt_followers(max(p['follower_count']//20,100))} avg impressions/post",
            collab_angle="gifting",
        )
        for p in profiles
    ]


# ---------------------------------------------------------------------------
# Fallback: Claude-only archetypes (no Instagram access)
# ---------------------------------------------------------------------------

async def _claude_archetypes(
    persona: Persona, product_idea: str, brand_name: str, count: int
) -> list[InfluencerMatch]:
    client = get_openai_client()
    if not client:
        return []

    prompt = (
        f"Brand: {brand_name}\nProduct: {product_idea}\n"
        f"Customer: {persona.summary}\n"
        f"Aesthetic: {', '.join(persona.aesthetic_keywords[:4])}\n"
        f"Interests: {', '.join(persona.interests[:4])}\n\n"
        f"Generate {count} specific influencer archetypes for this brand.\n"
        f"Use real-feeling handles (e.g. @thriftedrunway, @ceramicstudio). Mix platforms.\n\n"
        f'Return JSON array: [{{"handle":"@x","platform":"instagram|tiktok|youtube",'
        f'"niche":"niche","follower_tier":"nano (1K–10K)|micro (10K–100K)|macro (100K–1M)",'
        f'"why":"reason","content_style":"formats","estimated_reach":"~XK avg",'
        f'"collab_angle":"gifting|paid post|affiliate|co-design|ambassador"}}]\n'
        f"Only return the JSON array."
    )
    try:
        resp = await client.messages.create(
            model=_MODEL, max_tokens=1400, system=_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = resp.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw).rstrip("```").strip()
        data = json.loads(raw)
        return [InfluencerMatch(**{k: item.get(k, "") for k in InfluencerMatch.model_fields}) for item in data[:count]]
    except Exception as exc:
        log.warning("claude_archetypes failed (%s)", exc)
        return []


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def find_influencers(
    persona: Persona,
    product_idea: str,
    brand_name: str,
    count: int = 6,
    following_usernames: list[str] | None = None,
) -> list[InfluencerMatch]:
    """Find real Instagram influencers from the user's following list.
    Falls back to Claude archetypes if no real accounts found.
    """

    # Step 1: try to get real profiles from following list
    real_profiles: list[dict] = []

    if following_usernames:
        log.info("find_influencers: checking %d following accounts for influencers", len(following_usernames))
        real_profiles = await _fetch_following_profiles(following_usernames, target_count=count * 2)
        log.info("find_influencers: found %d real influencer profiles", len(real_profiles))

    if real_profiles:
        # Step 2: score and explain with Claude
        matches = await _score_profiles(real_profiles, persona, product_idea, brand_name, count)
        if matches:
            return matches

    # Fallback: Claude-generated archetypes
    log.info("find_influencers: no real profiles found — using Claude archetypes")
    return await _claude_archetypes(persona, product_idea, brand_name, count)
