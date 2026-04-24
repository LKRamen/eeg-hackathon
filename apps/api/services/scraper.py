from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from pathlib import Path

from models.schemas import RawAudience, RawAudiencePost

logger = logging.getLogger(__name__)

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"
CACHE_DIR = Path(__file__).parent.parent / "cache"

_HASHTAG_RE = re.compile(r"#\w+")
_MENTION_RE = re.compile(r"@\w+")


class ScraperError(Exception):
    pass


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_hashtags(text: str) -> list[str]:
    return _HASHTAG_RE.findall(text.lower())


def _extract_mentions(text: str) -> list[str]:
    return _MENTION_RE.findall(text.lower())


def _top_n(items: list[str], n: int) -> list[str]:
    return [item for item, _ in Counter(items).most_common(n)]


def _load_fixture(platform: str) -> RawAudience:
    fixture_path = FIXTURES_DIR / f"sample_audience_{platform}.json"
    if not fixture_path.exists():
        fixture_path = FIXTURES_DIR / "sample_audience.json"
    logger.warning("Loading %s audience from fixture: %s", platform, fixture_path)
    return RawAudience(**json.loads(fixture_path.read_text()))


def _cache_path(handle: str, platform: str) -> Path:
    return CACHE_DIR / f"{handle}_{platform}_raw.json"


def _save_cache(handle: str, platform: str, data: dict) -> None:
    path = _cache_path(handle, platform)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, default=str))
    logger.info("Cached raw %s scrape to %s", platform, path)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

async def scrape(handle: str, platform: str = "instagram") -> RawAudience:
    """Scrape a creator profile. Falls back to fixture on any failure."""
    handle = handle.lstrip("@").lower()

    cached = _cache_path(handle, platform)
    if cached.exists():
        logger.info("Loading cached %s scrape for @%s", platform, handle)
        return _build_audience(json.loads(cached.read_text()), platform)

    try:
        if platform == "instagram":
            return await _scrape_instagram(handle)
        elif platform == "x":
            return await _scrape_x(handle)
        else:
            raise ScraperError(f"Platform '{platform}' scraping not yet implemented.")
    except ScraperError:
        raise
    except Exception as exc:
        logger.warning("%s scrape failed (%s) — using fixture fallback", platform, exc)
        return _load_fixture(platform)


# ---------------------------------------------------------------------------
# Instagram — instaloader (free, no API key)
# ---------------------------------------------------------------------------

async def _scrape_instagram(handle: str) -> RawAudience:
    import instaloader  # type: ignore

    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        quiet=True,
    )

    try:
        profile = instaloader.Profile.from_username(L.context, handle)
    except instaloader.exceptions.ProfileNotExistsException:
        raise ScraperError(f"Instagram profile @{handle} does not exist.")
    except instaloader.exceptions.PrivateProfileNotFollowedException:
        raise ScraperError(f"Instagram profile @{handle} is private.")

    raw_posts = []
    for post in profile.get_posts():
        raw_posts.append({
            "caption": post.caption or "",
            "like_count": post.likes,
            "comment_count": post.comments,
            "posted_at": post.date_utc.isoformat(),
            "image_url": post.url,
        })
        if len(raw_posts) >= 20:
            break

    raw = {
        "profile": {
            "biography": profile.biography or "",
            "followersCount": profile.followers,
        },
        "posts": raw_posts,
    }
    _save_cache(handle, "instagram", raw)
    return _build_audience(raw, "instagram")


def _parse_instagram_posts(raw_posts: list[dict]) -> list[RawAudiencePost]:
    posts = []
    for p in raw_posts[:20]:
        caption = p.get("caption") or ""
        posts.append(RawAudiencePost(
            caption=caption,
            hashtags=_extract_hashtags(caption),
            like_count=p.get("likesCount") or p.get("like_count") or 0,
            comment_count=p.get("commentsCount") or p.get("comment_count") or 0,
            posted_at=p.get("timestamp") or p.get("posted_at"),
            image_url=p.get("displayUrl") or p.get("image_url"),
        ))
    return posts


# ---------------------------------------------------------------------------
# X (Twitter) — twscrape (free, needs a Twitter account)
# ---------------------------------------------------------------------------
# Setup (one-time):
#   twscrape add_account your_x_username your_x_password your_email your_email_password
#   twscrape login_all
#
# Or via env vars: X_USERNAME, X_PASSWORD, X_EMAIL, X_EMAIL_PASSWORD
# ---------------------------------------------------------------------------

async def _scrape_x(handle: str) -> RawAudience:
    import twscrape  # type: ignore

    api = twscrape.API()

    # Auto-add account from env vars if credentials are present and no accounts loaded
    x_user = os.environ.get("X_USERNAME")
    x_pass = os.environ.get("X_PASSWORD")
    x_email = os.environ.get("X_EMAIL")
    x_email_pass = os.environ.get("X_EMAIL_PASSWORD")
    if x_user and x_pass and x_email and x_email_pass:
        await api.pool.add_account(x_user, x_pass, x_email, x_email_pass)
        await api.pool.login_all()

    # Fetch user profile
    user = await api.user_by_login(handle)
    if user is None:
        raise ScraperError(f"X profile @{handle} not found.")

    raw_posts: list[dict] = []
    async for tweet in api.user_tweets(user.id, limit=20):
        raw_posts.append({
            "caption": tweet.rawContent or "",
            "like_count": tweet.likeCount or 0,
            "comment_count": tweet.replyCount or 0,
            "posted_at": tweet.date.isoformat() if tweet.date else None,
        })

    raw = {
        "profile": {
            "biography": user.rawDescription or "",
            "followersCount": user.followersCount or 0,
        },
        "posts": raw_posts,
    }
    _save_cache(handle, "x", raw)
    return _build_audience(raw, "x")


def _parse_x_posts(raw_posts: list[dict]) -> list[RawAudiencePost]:
    posts = []
    for p in raw_posts[:20]:
        text = p.get("caption") or p.get("text") or p.get("full_text") or ""
        posts.append(RawAudiencePost(
            caption=text,
            hashtags=_extract_hashtags(text),
            like_count=p.get("likeCount") or p.get("like_count") or 0,
            comment_count=p.get("replyCount") or p.get("comment_count") or 0,
            posted_at=p.get("createdAt") or p.get("posted_at"),
            image_url=None,
        ))
    return posts


# ---------------------------------------------------------------------------
# Shared audience builder
# ---------------------------------------------------------------------------

def _build_audience(data: dict, platform: str) -> RawAudience:
    profile = data.get("profile", {})
    raw_posts = data.get("posts", [])

    bio = profile.get("biography") or profile.get("description") or profile.get("bio") or ""
    follower_count = (
        profile.get("followersCount")
        or profile.get("followers_count")
        or 0
    )

    if platform == "x":
        posts = _parse_x_posts(raw_posts)
    else:
        posts = _parse_instagram_posts(raw_posts)

    if not posts and not bio:
        raise ScraperError("Profile appears to be private or empty.")

    all_hashtags = [ht for p in posts for ht in p.hashtags]
    all_mentions = [m for p in posts for m in _extract_mentions(p.caption)]

    return RawAudience(
        bio=bio,
        follower_count=follower_count,
        posts=posts,
        top_hashtags=_top_n(all_hashtags, 15),
        top_mentioned_accounts=_top_n(all_mentions, 10),
    )
