from __future__ import annotations

import json
import logging
from functools import lru_cache
from typing import Any, Awaitable, Callable, Optional, TypeVar

from openai import AsyncOpenAI

from apps.api.config import get_settings

logger = logging.getLogger(__name__)

T = TypeVar("T")


@lru_cache(maxsize=1)
def get_openai_client() -> Optional[AsyncOpenAI]:
    """Returns a cached AsyncOpenAI client, or None when no key is set.

    Services check for None and fall back to deterministic fixtures so the
    scaffold boots without credentials.
    """
    key = get_settings().openai_api_key
    if not key:
        return None
    return AsyncOpenAI(api_key=key)


async def call_json_mode(
    *,
    client: AsyncOpenAI,
    system: str,
    user: str,
    validator: Callable[[dict[str, Any]], T],
    model: str = "gpt-4o",
    temperature: float = 0.7,
    retries: int = 1,
    repair_hint: str = "",
) -> T:
    """Call GPT in JSON mode, parse, validate, retry once on failure.

    Validator must raise ValueError with a short, model-readable message on
    bad input. That message + repair_hint is appended to the user prompt
    on retry.
    """
    last_err: Optional[Exception] = None
    user_prompt = user

    for attempt in range(retries + 1):
        try:
            resp = await client.chat.completions.create(
                model=model,
                temperature=temperature,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = resp.choices[0].message.content or "{}"
            parsed = json.loads(content)
            return validator(parsed)
        except (ValueError, json.JSONDecodeError) as err:
            last_err = err
            logger.warning("call_json_mode attempt %d failed: %s", attempt, err)
            user_prompt = (
                f"{user}\n\nYour previous response was rejected: {err}. "
                f"{repair_hint}"
            )

    assert last_err is not None
    raise last_err
