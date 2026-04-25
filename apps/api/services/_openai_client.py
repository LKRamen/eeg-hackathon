from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any, Callable, Optional, TypeVar

from anthropic import AsyncAnthropic

from ..config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T")

MODEL = "claude-3-5-sonnet-20241022"


@lru_cache(maxsize=1)
def get_claude_client() -> Optional[AsyncAnthropic]:
    """Returns a cached AsyncAnthropic client, or None when no key is set."""
    key = get_settings().anthropic_api_key
    if not key:
        return None
    return AsyncAnthropic(api_key=key)


# Keep old name as alias so any code that imports get_openai_client still works
get_openai_client = get_claude_client


async def call_json_mode(
    *,
    client: AsyncAnthropic,
    system: str,
    user: str,
    validator: Callable[[dict[str, Any]], T],
    model: str = MODEL,
    temperature: float = 0.7,
    retries: int = 1,
    repair_hint: str = "",
) -> T:
    """Call Claude, parse JSON from the response, validate, retry once on failure."""
    last_err: Optional[Exception] = None
    user_prompt = user

    for attempt in range(retries + 1):
        try:
            resp = await client.messages.create(
                model=model,
                max_tokens=2048,
                temperature=temperature,
                system=system + "\n\nRespond with valid JSON only. No preamble, no markdown fences.",
                messages=[{"role": "user", "content": user_prompt}],
            )
            content = resp.content[0].text if resp.content else "{}"
            # Strip accidental markdown fences
            content = content.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
            parsed = json.loads(content)
            return validator(parsed)
        except (ValueError, json.JSONDecodeError) as err:
            last_err = err
            logger.warning("call_json_mode attempt %d failed: %s", attempt, err)
            user_prompt = (
                f"{user}\n\nYour previous response was rejected: {err}. "
                f"{repair_hint} Return valid JSON only."
            )

    assert last_err is not None
    raise last_err
