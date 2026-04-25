"""Demo cache — serve a pre-computed BrandResult with simulated stage progression.

When CACHE_MODE=true and the incoming handle matches DEMO_HANDLE, the API
returns the cached `cache/{handle}/result.json` instead of running the
real pipeline. The frontend animation still plays end-to-end because we
walk through the same status transitions on a timer.
"""

from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path
from typing import Optional

from ..models.schemas import BrandResult
from . import jobs_db

logger = logging.getLogger(__name__)

_CACHE_ROOT = Path(__file__).resolve().parent.parent / "cache"

# Stage timings — each "phase" of the fake pipeline. Total ~13s, mirrors a
# real run so the loading UX feels authentic.
_STAGES: tuple[tuple[str, float], ...] = (
    ("scraping", 2.0),
    ("synthesizing", 3.0),
    ("generating", 4.0),
    ("matching", 2.0),
    ("exporting", 2.0),
)


def is_cached_handle(handle: str, demo_handle: str) -> bool:
    """Match the user-submitted handle against the configured demo handle.
    Strips '@' prefix and lowercases both sides."""
    norm = handle.lower().lstrip("@").strip()
    target = demo_handle.lower().lstrip("@").strip()
    return bool(target) and norm == target


def cached_result_for(handle: str) -> Optional[BrandResult]:
    """Load the cached BrandResult for this handle, or None if missing."""
    norm = handle.lower().lstrip("@").strip()
    path = _CACHE_ROOT / norm / "result.json"
    if not path.exists():
        logger.warning("No cached result at %s", path)
        return None
    try:
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
        # Cache files store the wrapped Job; extract result.
        if "result" in payload and payload["result"]:
            return BrandResult.model_validate(payload["result"])
        return BrandResult.model_validate(payload)
    except Exception:
        logger.exception("Failed to load cached result from %s", path)
        return None


async def play_cached_pipeline(job_id: str, handle: str) -> None:
    """Walk through fake status transitions, then set the cached result."""
    try:
        result = cached_result_for(handle)
        if result is None:
            jobs_db.set_error(job_id, f"No cached result for handle {handle!r}")
            return

        for status, delay in _STAGES:
            jobs_db.update_status(job_id, status)
            await asyncio.sleep(delay)

        jobs_db.set_result(job_id, result)
        logger.info("cached pipeline done: %s (handle=%s)", job_id, handle)
    except Exception as exc:
        logger.exception("cached pipeline error for %s", job_id)
        jobs_db.set_error(job_id, str(exc))
