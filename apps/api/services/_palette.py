from __future__ import annotations

import logging
import re
from typing import Any

from ..models.schemas import Color, PaletteRole, Persona

from ._openai_client import call_json_mode, get_openai_client

logger = logging.getLogger(__name__)

HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
ROLES: tuple[PaletteRole, ...] = ("primary", "secondary", "accent", "bg", "fg")
MIN_CONTRAST = 4.5

SYSTEM_PROMPT = (
    "You are an art director who builds coherent brand palettes that feel "
    "pulled from a single world. You avoid pure primaries unless the "
    "aesthetic demands them. You name colors evocatively, not technically."
)


def _relative_luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    rgb = [int(h[i : i + 2], 16) / 255.0 for i in (0, 2, 4)]
    linear = [
        c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb
    ]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(hex_a: str, hex_b: str) -> float:
    """WCAG 2.0 contrast ratio. AA body text requires >= 4.5."""
    la = _relative_luminance(hex_a)
    lb = _relative_luminance(hex_b)
    lighter, darker = max(la, lb), min(la, lb)
    return (lighter + 0.05) / (darker + 0.05)


def _validate(parsed: dict[str, Any]) -> list[Color]:
    items = parsed.get("palette") or parsed.get("colors") or []
    if not isinstance(items, list) or len(items) != 5:
        raise ValueError("palette must be a list of exactly 5 colors")

    colors: list[Color] = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError("each palette entry must be an object")
        hex_value = str(item.get("hex", "")).strip()
        if not HEX_RE.match(hex_value):
            raise ValueError(f"invalid hex {hex_value!r}; expected #rrggbb")
        role = item.get("role")
        if role not in ROLES:
            raise ValueError(f"invalid role {role!r}; expected one of {ROLES}")
        name = str(item.get("name", "")).strip()
        if not name:
            raise ValueError("each color needs a name")
        colors.append(Color(hex=hex_value.lower(), role=role, name=name))

    seen = {c.role for c in colors}
    if len(seen) != 5:
        raise ValueError("each role (primary/secondary/accent/bg/fg) used exactly once")

    bg = next(c for c in colors if c.role == "bg")
    fg = next(c for c in colors if c.role == "fg")
    ratio = contrast_ratio(bg.hex, fg.hex)
    if ratio < MIN_CONTRAST:
        raise ValueError(
            f"bg/fg contrast {ratio:.2f} below WCAG AA {MIN_CONTRAST}"
        )
    return colors


def _fallback_palette(persona: Persona) -> list[Color]:
    return [
        Color(hex="#0a0a0a", role="primary", name="ink"),
        Color(hex="#f5f1e8", role="secondary", name="bone"),
        Color(hex="#c2410c", role="accent", name="rust"),
        Color(hex="#ffffff", role="bg", name="paper"),
        Color(hex="#0a0a0a", role="fg", name="char"),
    ]


def _force_safe_contrast(colors: list[Color]) -> list[Color]:
    bg = next(c for c in colors if c.role == "bg")
    bg_white = contrast_ratio("#ffffff", bg.hex) > contrast_ratio("#0a0a0a", bg.hex)
    safe_bg_hex = "#0a0a0a" if bg_white else "#ffffff"
    safe_fg_hex = "#ffffff" if bg_white else "#0a0a0a"
    return [
        Color(hex=safe_bg_hex, role="bg", name=bg.name) if c.role == "bg"
        else Color(hex=safe_fg_hex, role="fg", name=c.name) if c.role == "fg"
        else c
        for c in colors
    ]


async def generate_palette(persona: Persona, product_idea: str = "") -> list[Color]:
    """Returns exactly 5 Colors, one per role, with WCAG-AA bg/fg contrast."""
    client = get_openai_client()
    if client is None:
        logger.info("generate_palette: no OpenAI key, using fixture")
        return _fallback_palette(persona)

    user = (
        "Generate a 5-color palette for a brand with this aesthetic:\n"
        f"{persona.aesthetic_keywords}\n\n"
        f"The brand sells: {product_idea}\n"
        f"Customer feel: {persona.summary}\n\n"
        'Return JSON: {"palette": [{"hex": "#xxxxxx", '
        '"role": "primary|secondary|accent|bg|fg", "name": "single evocative word"}]}\n\n'
        "Rules: each role used exactly once. Hex valid 6-char with #. "
        "Strong contrast between bg and fg (WCAG AA, ratio > 4.5). "
        "Coherent — same world. Names like 'ink', 'bone', 'rust' — not "
        "'dark blue 1'."
    )
    try:
        return await call_json_mode(
            client=client,
            system=SYSTEM_PROMPT,
            user=user,
            validator=_validate,
            temperature=0.7,
            repair_hint="Fix only the issue noted; keep the rest.",
        )
    except ValueError as err:
        logger.warning("palette retry exhausted (%s); forcing safe contrast", err)
        try:
            partial = await call_json_mode(
                client=client,
                system=SYSTEM_PROMPT,
                user=user,
                validator=lambda p: [
                    Color(hex=str(i["hex"]).lower(), role=i["role"], name=i["name"])
                    for i in p.get("palette", [])
                ],
                retries=0,
            )
            return _force_safe_contrast(partial)
        except Exception:
            return _fallback_palette(persona)
