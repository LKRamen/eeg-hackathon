from __future__ import annotations

import json
import logging
import os
import re
from collections import Counter
from pathlib import Path

from ..models.schemas import NetworkProfile, RawAudience, RawAudiencePost

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
    with open(fixture_path, encoding="utf-8") as f:
        return RawAudience(**json.load(f))


def _cache_path(handle: str, platform: str) -> Path:
    return CACHE_DIR / f"{handle}_{platform}_raw.json"


def _save_cache(handle: str, platform: str, data: dict) -> None:
    path = _cache_path(handle, platform)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)
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
        with open(cached, encoding="utf-8") as f:
            return _build_audience(json.load(f), platform)

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
# Instagram — direct web API with browser cookies
# Bypasses instaloader's broken graphql endpoint entirely.
# ---------------------------------------------------------------------------

# Instagram's internal web app ID — required header for their JSON API
_IG_APP_ID = "936619743392459"


def _get_ig_cookies() -> dict:
    """Pull Instagram session cookies from Chrome or Firefox."""
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


def _ig_request(path: str, cookies: dict, params: dict | None = None) -> dict:
    """Make an authenticated request to Instagram's web API."""
    import requests  # type: ignore

    session = requests.Session()
    session.cookies.update(cookies)
    session.headers.update({
        "x-ig-app-id": _IG_APP_ID,
        "x-csrftoken": cookies.get("csrftoken", ""),
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/124.0.0.0 Safari/537.36"
        ),
        "Referer": "https://www.instagram.com/",
        "Accept": "*/*",
    })
    url = f"https://www.instagram.com/api/v1{path}"
    r = session.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json()


async def _scrape_instagram(handle: str) -> RawAudience:
    cookies = _get_ig_cookies()
    if not cookies:
        raise RuntimeError("No Instagram browser session found — log into Instagram in Chrome first")

    # Fetch profile
    try:
        data = _ig_request(
            "/users/web_profile_info/",
            cookies,
            params={"username": handle},
        )
    except Exception as exc:
        raise RuntimeError(f"Instagram profile fetch failed: {exc}") from exc

    user = data.get("data", {}).get("user")
    if not user:
        raise ScraperError(f"Instagram profile @{handle} not found or is private.")

    user_id = user["id"]
    bio = user.get("biography", "")
    follower_count = user.get("edge_followed_by", {}).get("count", 0)

    # Fetch recent posts via feed endpoint
    raw_posts = []
    try:
        feed = _ig_request(f"/feed/user/{user_id}/", cookies, params={"count": 20})
        for item in feed.get("items", [])[:20]:
            caption = ""
            cap_node = item.get("caption")
            if isinstance(cap_node, dict):
                caption = cap_node.get("text", "")
            raw_posts.append({
                "caption": caption,
                "like_count": item.get("like_count", 0),
                "comment_count": item.get("comment_count", 0),
                "posted_at": str(item.get("taken_at", "")),
                "image_url": item.get("image_versions2", {}).get("candidates", [{}])[0].get("url", ""),
            })
    except Exception as exc:
        logger.warning("Could not fetch Instagram posts (%s)", exc)

    # Fetch followers sample
    followers: list[dict] = []
    try:
        f_data = _ig_request(f"/friendships/{user_id}/followers/", cookies, params={"count": 100})
        for u in f_data.get("users", []):
            followers.append({
                "username": u.get("username", ""),
                "bio": u.get("biography", "") or "",
                "follower_count": u.get("follower_count", 0),
            })
    except Exception as exc:
        logger.warning("Could not fetch Instagram followers (%s)", exc)

    # Fetch following sample
    following: list[dict] = []
    try:
        fo_data = _ig_request(f"/friendships/{user_id}/following/", cookies, params={"count": 100})
        for u in fo_data.get("users", []):
            following.append({
                "username": u.get("username", ""),
                "bio": u.get("biography", "") or "",
                "follower_count": u.get("follower_count", 0),
            })
            if len(following) >= 100:
                break
    except Exception as exc:
        logger.warning("Could not fetch Instagram following (%s)", exc)

    raw = {
        "profile": {"biography": bio, "followersCount": follower_count},
        "posts": raw_posts,
        "followers": followers,
        "following": following,
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

    # Check at least one account logged in successfully
    accounts = await api.pool.get_all()
    active = [a for a in accounts if a.active]
    if not active:
        raise RuntimeError("No active X accounts — login failed, using fixture fallback")

    # Fetch user profile
    user = await api.user_by_login(handle)
    if user is None:
        raise RuntimeError(f"X profile @{handle} not found or login blocked — using fixture fallback")

    raw_posts: list[dict] = []
    async for tweet in api.user_tweets(user.id, limit=20):
        raw_posts.append({
            "caption": tweet.rawContent or "",
            "like_count": tweet.likeCount or 0,
            "comment_count": tweet.replyCount or 0,
            "posted_at": tweet.date.isoformat() if tweet.date else None,
        })

    followers: list[dict] = []
    async for u in api.followers(user.id, limit=100):
        followers.append({
            "username": u.username,
            "bio": u.rawDescription or "",
            "follower_count": u.followersCount or 0,
        })

    following: list[dict] = []
    async for u in api.following(user.id, limit=100):
        following.append({
            "username": u.username,
            "bio": u.rawDescription or "",
            "follower_count": u.followersCount or 0,
        })

    raw = {
        "profile": {
            "biography": user.rawDescription or "",
            "followersCount": user.followersCount or 0,
        },
        "posts": raw_posts,
        "followers": followers,
        "following": following,
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

    followers_sample = [
        NetworkProfile(**f) for f in data.get("followers", [])[:100]
    ]
    following_sample = [
        NetworkProfile(**f) for f in data.get("following", [])[:100]
    ]

    return RawAudience(
        bio=bio,
        follower_count=follower_count,
        posts=posts,
        top_hashtags=_top_n(all_hashtags, 15),
        top_mentioned_accounts=_top_n(all_mentions, 10),
        followers_sample=followers_sample,
        following_sample=following_sample,
    )
