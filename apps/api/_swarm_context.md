# Swarm Context — Phase 1 (and onward)

Every parallel agent working on brand-system code reads this first. Shared
types, client patterns, retry helper, and file-path lanes live here so
swarms don't diverge in style.

## File-path lanes (Phase 1)

Each agent owns exactly one file. No agent edits another's lane.

| Agent | File | Function |
|---|---|---|
| A | `apps/api/services/_palette.py` | `generate_palette(persona) -> list[Color]` |
| B | `apps/api/services/_typography.py` | `generate_typography(persona) -> Typography` |
| C | `apps/api/services/_voice.py` | `generate_voice(brand_name, product_idea, persona) -> Voice` |

After all three finish, `apps/api/services/brand.py` re-exports:

```python
from ._palette import generate_palette
from ._typography import generate_typography
from ._voice import generate_voice
```

## Shared Pydantic types

Imports:

```python
from apps.api.models.schemas import (
    Persona, Color, FontSpec, Typography, Voice, BrandAssets,
)
```

Relevant shapes (see `apps/api/models/schemas.py` for defaults):

```python
class Persona(BaseModel):
    name: str
    age_range: str
    psychographics: list[str]
    interests: list[str]
    aesthetic_keywords: list[str]
    voice_traits: list[str]
    summary: str

class Color(BaseModel):
    hex: str           # "#1a1a1a" — 6-char lowercase preferred
    role: Literal["primary", "secondary", "accent", "bg", "fg"]
    name: str          # evocative single word: "ink", "bone", "rust"

class FontSpec(BaseModel):
    family: str
    google_url: str
    weights: list[int] = [400, 700]

class Typography(BaseModel):
    display: FontSpec
    body: FontSpec

class Voice(BaseModel):
    tone: str
    do: list[str]        # 3
    dont: list[str]      # 3
    examples: list[str]  # 3 — [tagline, product card, social caption]
```

## OpenAI client factory

Every Phase 1 agent uses this exact factory. Returns an `AsyncOpenAI`
client, or `None` if the key is missing (services then fall back to
fixtures — the hackathon scaffold boots without credentials).

```python
# apps/api/services/_openai_client.py
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from openai import AsyncOpenAI

from apps.api.config import get_settings


@lru_cache(maxsize=1)
def get_openai_client() -> Optional[AsyncOpenAI]:
    key = get_settings().openai_api_key
    if not key:
        return None
    return AsyncOpenAI(api_key=key)
```

## JSON+retry helper

Single shared retry pattern. Each agent inlines this or imports it from
`_openai_client.py`. Signature:

```python
async def call_json_mode(
    *,
    system: str,
    user: str,
    model: str = "gpt-4o-2024-08-06",
    temperature: float = 0.7,
    retries: int = 1,
    validator,                   # callable[[dict], T] raising on invalid
    repair_hint: str = "",       # appended to user prompt on retry
) -> T:
    """
    Call OpenAI with response_format={"type": "json_object"}, parse JSON,
    run validator. On validation failure, retry once with repair_hint
    + the raw failure message appended to user prompt. Raise on final
    failure.
    """
```

Validator convention: raise `ValueError` with a short, model-readable
message. That message is what we append on retry.

## Fixture fallback pattern

When `get_openai_client()` returns `None`, return a deterministic fixture
instead of raising. Keeps the scaffold bootable and tests fast.

```python
client = get_openai_client()
if client is None:
    return _fallback_palette(persona)  # module-local fixture
```

Each module owns its own `_fallback_*` — don't share across files.

## Ban-word list (for Voice agent)

Strip/retry if any appear in any example string:
`revolutionary`, `innovative`, `game-changing`, `unleash`, `elevate`,
`discerning`, `ambitious`, `passionate`, `cutting-edge`, `next-level`,
`premium`.

Also: no exclamation points. No `Introducing...` openers.

## Google Fonts whitelist (for Typography agent)

```
Inter, Space Grotesk, DM Sans, Manrope, Plus Jakarta Sans, Geist,
Bricolage Grotesque, Fraunces, Playfair Display, Crimson Pro,
EB Garamond, Cormorant, Lora, Instrument Serif, JetBrains Mono,
IBM Plex Sans, IBM Plex Serif, IBM Plex Mono, Bebas Neue, Archivo,
Syne, Outfit, Sora, Big Shoulders Display, Unica One
```

Fallback pair: `Space Grotesk` (display) + `Inter` (body).

## WCAG contrast helper (for Palette agent)

```python
def contrast_ratio(hex_a: str, hex_b: str) -> float:
    """Returns WCAG 2.0 contrast ratio between two hex colors.
    AA requires >= 4.5 for body text."""
```

Implementation: relative luminance per sRGB, then `(L1+0.05)/(L2+0.05)`.

## Testing without a key

Set `OPENAI_API_KEY=""` (already the default in `config.py`). Each
service's fallback fixture is deterministic — tests assert on shape, not
on model output. Use `unittest.mock.patch` to inject a fake
`AsyncOpenAI.chat.completions.create` when you want to test the
JSON-parsing/retry path.
