"""Quality iteration grid for visual asset generation.

Run from apps/api/:
    python -X utf8 _dev/quality_grid.py

Generates:
  - 6 logo variants (prompt mutations)
  - 3 tee + 3 tote mockup runs (consistency check)
  - 5 social assets (Pillow + HF)

Saves everything to /tmp/halo_grid/ and builds a self-contained
/tmp/halo_grid/grid.html, then opens it in the default browser.

No Supabase required. Use --no-ai to rebuild HTML from previously
generated images without re-running HF calls.
"""

from __future__ import annotations

import asyncio
import base64
import io
import sys
import webbrowser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.stdout.reconfigure(encoding="utf-8")

from PIL import Image

from models.schemas import Persona
from services.images import (
    _MOCKUP_NEGATIVE,
    _SOCIAL_NEGATIVE,
    _compose_text_post,
    _cf_generate,
    _hex_to_rgb,
    _logo_prompt,
    _mockup_prompt,
    _to_mono,
)

OUT_DIR = Path("/tmp/halo_grid")
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Demo persona and brand
# ---------------------------------------------------------------------------

DEMO_PERSONA = Persona(
    name="Mio",
    age_range="24-29",
    location_archetype="Brooklyn, Lisbon, Mexico City",
    psychographics=["values craft over hype", "anti-algorithm", "early adopter"],
    interests=["natural wine", "minimalist techno", "specialty coffee", "analogue photography"],
    purchase_signals=["small-batch coffee", "limited run clothing", "design-forward tools"],
    aesthetic_keywords=["matte black", "brutalist concrete", "Tokyo neon", "raw edges", "monospace type"],
    voice_traits=["dry", "observational", "knowing"],
    summary="Mio moves between creative cities collecting references. She buys for quality and story, not trend.",
)

BRAND_NAME = "Hush"
PRODUCT = "matcha energy drink for late-night creatives"
COLOR = "#0a0a0a"
TAGLINE = "Don't sleep on it."

# ---------------------------------------------------------------------------
# Logo variants — 6 prompt mutations to assess quality and adaptability
# ---------------------------------------------------------------------------

_LOGO_VARIANTS: list[tuple[str, str]] = [
    ("base",       ""),
    ("abstract",   "Pure abstract mark — zero product reference, concept only."),
    ("geometric",  "Hard angles only: triangles, rectangles, or hexagons. No curves."),
    ("swiss",      "Swiss grid system: mathematical baseline, structured grid alignment."),
    ("minimal",    "Maximum reduction. Single stroke or dot. Extreme negative space."),
    ("bold",       "Heavier weight, high contrast. Must read clearly at 32x32 favicon."),
]


async def _gen_logo(label: str, extra: str) -> Path:
    dest = OUT_DIR / f"logo_{label}.png"
    if dest.exists():
        return dest
    base = _logo_prompt(BRAND_NAME, PRODUCT, DEMO_PERSONA)
    prompt = f"{base} {extra}".strip() if extra else base
    img = await _cf_generate(prompt)
    img.convert("RGB").save(dest)
    print(f"  logo_{label} saved")
    return dest


# ---------------------------------------------------------------------------
# Mockup variants — 3 runs per label to check consistency
# ---------------------------------------------------------------------------

async def _gen_mockup(label: str, idx: int) -> Path:
    dest = OUT_DIR / f"mockup_{label}_{idx}.png"
    if dest.exists():
        return dest
    prompt, w, h = _mockup_prompt(label, DEMO_PERSONA)
    img = await _cf_generate(prompt, negative_prompt=_MOCKUP_NEGATIVE, width=w, height=h)
    img.convert("RGB").save(dest)
    print(f"  mockup_{label}_{idx} saved")
    return dest


# ---------------------------------------------------------------------------
# Social assets — Pillow composition for hero/quote/story, HF for lifestyle
# ---------------------------------------------------------------------------

async def _gen_social(logo_path: Path) -> list[tuple[str, Path]]:
    logo_pil = Image.open(logo_path).convert("RGBA")
    mono_light = _to_mono(logo_pil, (255, 255, 255))
    results: list[tuple[str, Path]] = []

    # --- Pillow-composed posts (synchronous) ---

    hero_path = OUT_DIR / "social_hero.png"
    if not hero_path.exists():
        img = _compose_text_post((1080, 1080), COLOR, mono_light, None)
        img.save(hero_path)
        print("  social_hero saved")
    results.append(("ig_post_hero\n1080×1080", hero_path))

    quote_path = OUT_DIR / "social_quote.png"
    if not quote_path.exists():
        img = _compose_text_post((1080, 1080), "#ffffff", None, TAGLINE,
                                 text_color_hex=COLOR, font_size=72)
        img.save(quote_path)
        print("  social_quote saved")
    results.append(("ig_post_quote\n1080×1080", quote_path))

    launch_path = OUT_DIR / "social_story_launch.png"
    if not launch_path.exists():
        img = _compose_text_post((1080, 1920), COLOR, mono_light, "COMING SOON",
                                 text_color_hex="#ffffff", font_size=90)
        img.save(launch_path)
        print("  social_story_launch saved")
    results.append(("ig_story_launch\n1080×1920", launch_path))

    # --- HF-generated posts (async) ---

    kw = DEMO_PERSONA.aesthetic_keywords
    scene_map = {
        "brutalist": "raw concrete cityscape at dusk, harsh shadows",
        "neon":      "rain-soaked neon-lit Tokyo alleyway at night",
        "organic":   "sun-drenched linen table, dried botanicals",
        "pastel":    "soft morning light through sheer curtains",
    }
    scene = next(
        (v for k, v in scene_map.items() if any(k in w.lower() for w in kw)),
        "atmospheric editorial scene",
    )
    lifestyle_prompt = (
        f"Atmospheric lifestyle photograph, {kw[0]} aesthetic. "
        f"{scene}. Editorial composition, magazine quality, natural light."
    )
    closeup_prompt = (
        f"Atmospheric vertical close-up texture photograph. {kw[0]} aesthetic. "
        f"Extreme macro, cinematic grain, moody. NEGATIVE: {_SOCIAL_NEGATIVE}"
    )

    lifestyle_path = OUT_DIR / "social_lifestyle.png"
    closeup_path = OUT_DIR / "social_story_closeup.png"
    need_lifestyle = not lifestyle_path.exists()
    need_closeup = not closeup_path.exists()

    if need_lifestyle or need_closeup:
        tasks = []
        if need_lifestyle:
            tasks.append(_cf_generate(lifestyle_prompt, negative_prompt=_SOCIAL_NEGATIVE,
                                      width=1024, height=1024))
        if need_closeup:
            tasks.append(_cf_generate(closeup_prompt, width=768, height=1344))

        generated = await asyncio.gather(*tasks)
        gi = iter(generated)
        if need_lifestyle:
            next(gi).convert("RGB").save(lifestyle_path)
            print("  social_lifestyle saved")
        if need_closeup:
            next(gi).convert("RGB").save(closeup_path)
            print("  social_story_closeup saved")

    results.append(("ig_post_lifestyle\n1080×1080", lifestyle_path))
    results.append(("ig_story_closeup\n1080×1920", closeup_path))

    return results


# ---------------------------------------------------------------------------
# HTML builder
# ---------------------------------------------------------------------------

def _img_tag(path: Path, max_w: int = 220, max_h: int = 220) -> str:
    data = base64.b64encode(path.read_bytes()).decode()
    return (
        f'<img src="data:image/png;base64,{data}" '
        f'style="max-width:{max_w}px;max-height:{max_h}px;display:block;">'
    )


def _section(title: str, checklist: list[str], items: list[tuple[str, Path]],
              thumb_w: int = 220, thumb_h: int = 220) -> str:
    checks = "".join(f"<li>[ ] {c}</li>" for c in checklist)
    cards = ""
    for label, path in items:
        label_html = label.replace("\n", "<br>")
        cards += (
            f'<div class="card">'
            f'{_img_tag(path, thumb_w, thumb_h)}'
            f'<div class="label">{label_html}</div>'
            f'</div>'
        )
    return (
        f'<h2>{title}</h2>'
        f'<ul class="check">{checks}</ul>'
        f'<div class="grid">{cards}</div>'
    )


def build_html(
    logo_paths: list[tuple[str, Path]],
    mockup_paths: list[tuple[str, Path]],
    social_paths: list[tuple[str, Path]],
) -> str:
    logo_section = _section(
        "Logos — 6 Prompt Variants",
        [
            "Scales cleanly to 32×32 favicon?",
            "Single clear silhouette (not a compound mark)?",
            "Could a designer trace this as a vector?",
            "No FLUX default swirl/infinity loop?",
            "Which variant adapts best to the aesthetic keywords?",
        ],
        logo_paths,
        thumb_w=200, thumb_h=200,
    )
    mockup_section = _section(
        "Mockups — 3 Runs per Type (Consistency Check)",
        [
            "Looks like a real product photo, not generated?",
            "Emblem feels appropriate scale (not too prominent)?",
            "Surface/lighting matches the brand aesthetic?",
            "3 runs look consistent enough to pick the best one?",
        ],
        mockup_paths,
        thumb_w=200, thumb_h=200,
    )
    social_section = _section(
        "Social Assets — 5 Posts",
        [
            "Hero: logo + brand color feels iconic at a glance?",
            "Quote: typography rendering cleanly, no weird kerning?",
            "Lifestyle: would this fit on a real brand IG grid?",
            "Story launch: readable at phone thumbnail size?",
            "Story closeup: cinematic mood, no text artifacts?",
        ],
        social_paths,
        thumb_w=160, thumb_h=240,
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Halo Quality Grid — {BRAND_NAME}</title>
<style>
  body {{
    background: #0d0d0d; color: #e0e0e0;
    font-family: "JetBrains Mono", "Courier New", monospace;
    padding: 32px 40px; margin: 0;
  }}
  h1 {{ font-size: 18px; color: #fff; margin-bottom: 4px; }}
  .meta {{ font-size: 11px; color: #555; margin-bottom: 40px; }}
  h2 {{ font-size: 13px; color: #aaa; text-transform: uppercase;
        letter-spacing: 2px; border-bottom: 1px solid #222;
        padding-bottom: 8px; margin: 0 0 8px; }}
  .check {{ font-size: 11px; color: #555; margin: 0 0 16px; padding: 0;
            list-style: none; }}
  .check li {{ margin-bottom: 3px; }}
  .grid {{ display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 48px; }}
  .card {{ text-align: center; }}
  .card img {{ border: 1px solid #222; }}
  .label {{ font-size: 10px; color: #666; margin-top: 6px; line-height: 1.4; }}
</style>
</head>
<body>
<h1>Halo Quality Grid — {BRAND_NAME}</h1>
<div class="meta">
  Brand: {BRAND_NAME} &nbsp;|&nbsp;
  Product: {PRODUCT} &nbsp;|&nbsp;
  Color: {COLOR} &nbsp;|&nbsp;
  Keywords: {", ".join(DEMO_PERSONA.aesthetic_keywords)}
</div>
{logo_section}
{mockup_section}
{social_section}
</body>
</html>"""


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

async def main(skip_ai: bool = False) -> None:
    print(f"[grid] Output dir: {OUT_DIR}")

    # Logos — 6 variants in parallel (skip if --no-ai and files exist)
    print("[grid] Generating logos...")
    if skip_ai:
        logo_paths = [(v[0], OUT_DIR / f"logo_{v[0]}.png") for v in _LOGO_VARIANTS
                      if (OUT_DIR / f"logo_{v[0]}.png").exists()]
    else:
        logo_paths = list(zip(
            [v[0] for v in _LOGO_VARIANTS],
            await asyncio.gather(*[_gen_logo(label, extra) for label, extra in _LOGO_VARIANTS]),
        ))

    # Mockups — 3 runs × 2 types in parallel
    print("[grid] Generating mockups...")
    mockup_specs = [(label, i) for label in ["tee", "tote"] for i in range(1, 4)]
    if skip_ai:
        mockup_results = [
            (f"{label} #{i}", OUT_DIR / f"mockup_{label}_{i}.png")
            for label, i in mockup_specs
            if (OUT_DIR / f"mockup_{label}_{i}.png").exists()
        ]
    else:
        mockup_imgs = await asyncio.gather(*[_gen_mockup(label, i) for label, i in mockup_specs])
        mockup_results = [(f"{label} #{i}", path) for (label, i), path in zip(mockup_specs, mockup_imgs)]

    # Social assets — use first logo as reference
    print("[grid] Generating social assets...")
    logo_ref = logo_paths[0][1] if logo_paths else None
    if logo_ref and logo_ref.exists():
        social_results = await _gen_social(logo_ref)
    else:
        social_results = []

    # Build HTML
    print("[grid] Building grid.html...")
    html = build_html(logo_paths, mockup_results, social_results)
    grid_path = OUT_DIR / "grid.html"
    grid_path.write_text(html, encoding="utf-8")
    print(f"[grid] Saved: {grid_path}")

    webbrowser.open(grid_path.as_uri())
    print("[grid] Opened in browser.")


if __name__ == "__main__":
    skip = "--no-ai" in sys.argv
    asyncio.run(main(skip_ai=skip))
