from __future__ import annotations

"""Visual asset generation.

Image generation strategy:
  All AI images → Hugging Face Inference API (free tier)
                  Default model: black-forest-labs/FLUX.1-schnell (Apache 2.0, no cost)
                  Override via IMAGE_MODEL env var.

  Logo primary   → HF text-to-image → PIL Image
  Logo variants  → Pillow processing (mono, on-brand, avatar) — free, instant
  Mockups        → Canva autofill if templates configured, else HF text-to-image
  Social kit     → HF for lifestyle/story imagery; Pillow composition for hero/quote

All images are rehosted in Supabase storage before returning URLs.
"""

import asyncio
import io
from pathlib import Path
from typing import Literal

import httpx
from huggingface_hub import AsyncInferenceClient
from PIL import Image, ImageDraw, ImageFont

from ..config import get_settings
from ..models.schemas import LogoVariants, Mockup, Persona, SocialAsset
from . import canva, storage

# ---------------------------------------------------------------------------
# HF client
# ---------------------------------------------------------------------------

_hf_client: AsyncInferenceClient | None = None


def _client() -> AsyncInferenceClient:
    global _hf_client
    if _hf_client is None:
        _hf_client = AsyncInferenceClient(token=get_settings().hf_token or None)
    return _hf_client


async def _hf_generate(
    prompt: str,
    negative_prompt: str = "",
    width: int = 1024,
    height: int = 1024,
) -> Image.Image:
    """Run text-to-image via HF Inference API, return a PIL Image."""
    model = get_settings().image_model
    kwargs: dict = dict(
        prompt=prompt,
        model=model,
        width=width,
        height=height,
    )
    # FLUX.1-schnell ignores negative_prompt; SDXL and others use it
    if negative_prompt and "flux" not in model.lower():
        kwargs["negative_prompt"] = negative_prompt

    img = await _client().text_to_image(**kwargs)
    return img.convert("RGBA")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_ASSETS_DIR = Path(__file__).parent.parent / "assets"
_FONTS_DIR = _ASSETS_DIR / "fonts"

_AESTHETIC_CONTEXT: dict[str, tuple[str, str]] = {
    "brutalist": ("charcoal grey", "raw concrete slab"),
    "concrete": ("charcoal grey", "raw concrete slab"),
    "organic": ("natural cream", "oak wood plank"),
    "natural": ("natural cream", "oak wood plank"),
    "y2k": ("bright white", "iridescent acrylic"),
    "chrome": ("bright white", "iridescent acrylic"),
    "neon": ("jet black", "glossy black acrylic"),
    "pastel": ("soft white", "blush pink linen"),
    "editorial": ("heather grey", "white marble slab"),
}

_DEFAULT_TEE = ("heather grey", "linen backdrop")


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _aesthetic_context(keywords: list[str]) -> tuple[str, str]:
    for kw in keywords:
        for key, val in _AESTHETIC_CONTEXT.items():
            if key in kw.lower():
                return val
    return _DEFAULT_TEE


_FONT_CACHE: dict[str, Path] = {}


def get_google_font_ttf(family: str, weight: int = 700) -> Path | None:
    """Download a Google Font TTF by family name, cache to /tmp/halo_fonts/.

    Uses an old User-Agent to request the TTF format from Google Fonts CSS2 API.
    Returns the local Path on success, or None if download fails.
    """
    import re
    slug = re.sub(r"[^a-zA-Z0-9]", "_", family.lower())
    cache_key = f"{slug}_{weight}"
    if cache_key in _FONT_CACHE and _FONT_CACHE[cache_key].exists():
        return _FONT_CACHE[cache_key]

    cache_dir = Path("/tmp/halo_fonts")
    cache_dir.mkdir(parents=True, exist_ok=True)
    dest = cache_dir / f"{slug}_{weight}.ttf"
    if dest.exists():
        _FONT_CACHE[cache_key] = dest
        return dest

    try:
        css_url = (
            f"https://fonts.googleapis.com/css2"
            f"?family={family.replace(' ', '+')}:wght@{weight}"
        )
        # Old IE UA causes Google Fonts to return TTF instead of woff2
        old_ua = "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)"
        css_resp = httpx.get(css_url, headers={"User-Agent": old_ua},
                             timeout=10, follow_redirects=True)
        css_resp.raise_for_status()
        match = re.search(
            r"url\((https://fonts\.gstatic\.com/[^)]+\.ttf)\)", css_resp.text
        )
        if not match:
            return None
        font_resp = httpx.get(match.group(1), timeout=15)
        font_resp.raise_for_status()
        dest.write_bytes(font_resp.content)
        _FONT_CACHE[cache_key] = dest
        return dest
    except Exception as e:
        print(f"  [images] Google Font download failed ({family}): {e}")
        return None


def _pick_font(
    size: int = 72, family: str | None = None
) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    if family:
        path = get_google_font_ttf(family)
        if path:
            try:
                return ImageFont.truetype(str(path), size)
            except Exception:
                pass
    for name in ["SpaceGrotesk-Bold.ttf", "Inter-Bold.ttf", "DMSans-Bold.ttf"]:
        path = _FONTS_DIR / name
        if path.exists():
            try:
                return ImageFont.truetype(str(path), size)
            except Exception:
                pass
    return ImageFont.load_default()


# ---------------------------------------------------------------------------
# Logo generation
# ---------------------------------------------------------------------------

# Keyword → specific historical design reference (drives specificity over generic output)
_KEYWORD_REFERENCES: dict[str, str] = {
    "brutalist":  "1970s European brutalist architectural wayfinding and concrete typography",
    "concrete":   "1970s Swiss brutalist signage systems",
    "neon":       "1980s Tokyo Shinjuku neon district visual identity and Blade Runner title design",
    "tokyo":      "1980s Tokyo subway system pictogram design",
    "organic":    "1960s natural food movement branding and Pacific Coast botanical illustration",
    "natural":    "mid-century Scandinavian nature illustration",
    "y2k":        "early 2000s tech company logo design, translucent plasticity, Windows XP era",
    "chrome":     "1950s American automotive badge design and NASA Apollo program identity",
    "editorial":  "1960s Penguin Books cover grid and International Style magazine mastheads",
    "pastel":     "1950s mid-century illustration and Scandinavian folk art modernism",
    "minimal":    "Dieter Rams product philosophy and IBM corporate identity by Paul Rand",
    "monospace":  "1980s terminal UI iconography and early Macintosh system icons",
    "titanium":   "1990s Braun industrial product design and Apple PowerBook hardware aesthetic",
    "holographic":"2010s tech company identity systems and spatial computing UI glyphs",
    "carbon":     "Formula 1 aerodynamics data visualization and aerospace engineering schematics",
    "surgical":   "medical device identity design and Swiss precision instrument branding",
}

# Keyword → shape guidance (prevents swirls and generic output)
_KEYWORD_SHAPE: dict[str, str] = {
    "brutalist":  "hard 90-degree angles, rectangular forms, no curves whatsoever",
    "concrete":   "angular slab geometry, heavy weight, no curves",
    "organic":    "single flowing curve, leaf or wave form, no hard corners",
    "natural":    "one continuous curved shape, botanical silhouette",
    "y2k":        "rounded pill or bubble shape, friendly and soft",
    "chrome":     "bold circular or shield form, radial symmetry",
    "neon":       "single bold stroke, tubular loop, high contrast",
    "minimal":    "one thin line or minimal dot composition, extreme negative space",
    "monospace":  "square grid-based symbol, pixel-precise geometry",
    "titanium":   "precise thin geometry, aerospace-grade minimal form",
    "holographic":"hexagonal or radial glyph, techno-symbolic",
    "carbon":     "angular chevron or directional arrow form",
    "surgical":   "cross-derived or circular precision form, medical clarity",
}

_LOGO_INLINE_NEGATIVE = (
    "NEGATIVE: no text, no letters, no letterforms, no glyphs resembling letters, "
    "no typography, no words, no numbers, no 3D rendering, no gradients, "
    "no drop shadows, no photorealism, no photograph, no compound logos, "
    "no detailed illustrations, no busy compositions, no multiple shapes, "
    "no watermarks, no signatures, no AI signatures, no mascots, no cartoon, "
    "no clip art, no swirls, no infinity loops, no sparkles, no generic icons, "
    "vector flat 2D illustration only, not a photograph"
)


def _persona_brief(persona: Persona, product_idea: str) -> dict:
    """Distill persona data into brand brief descriptors for image prompts."""
    kw = persona.aesthetic_keywords or ["minimal", "contemporary"]
    voice = persona.voice_traits or []
    interests = persona.interests or []
    purchase = persona.purchase_signals or []
    psycho = persona.psychographics or []

    # Core mood: first 3 aesthetic keywords, cleaned to single adjectives
    mood = [w.split()[0] for w in kw[:3]] if kw else ["refined", "contemporary", "bold"]

    # Voice personality: strip the "— explanation" and take the lead word
    voice_words = [v.split("—")[0].strip().split()[0] for v in voice[:2]] if voice else ["considered", "precise"]

    # Cultural context: 2 interests trimmed to ~4 words each
    def _short(s: str, n: int = 4) -> str:
        return " ".join(s.split()[:n])
    interest_ctx = [_short(i) for i in interests[:2]] if interests else ["premium design culture", "contemporary craft"]

    # Product obsession signal: strip leading verb ("buys X" → "X", "invests in X" → "X")
    import re as _re
    raw_obs = purchase[0] if purchase else "premium limited-edition drops"
    raw_obs = _re.sub(r"^(buys|collects|invests in|follows|wears|shops|orders)\s+", "", raw_obs, flags=_re.I)
    obsession = _short(raw_obs, 5)

    # Audience mindset: first psychographic trimmed
    mindset = _short(psycho[0], 6) if psycho else "design-literate, culturally aware"

    # Shape bias from keyword table (keep existing logic)
    shape_bias = next(
        (shape for k, shape in _KEYWORD_SHAPE.items()
         if any(k in w.lower() for w in kw)),
        "single bold geometric shape, strong silhouette",
    )

    # Historical reference from keyword table
    reference = next(
        (ref for k, ref in _KEYWORD_REFERENCES.items()
         if any(k in w.lower() for w in kw)),
        "1960s Swiss International Style and Saul Bass film poster identity design",
    )

    # Scene for lifestyle photography
    scene_map = {
        "brutalist": "raw concrete architecture at dusk, dramatic shadow geometry",
        "concrete":  "raw concrete brutalist space, cinematic low light",
        "organic":   "sun-drenched natural linen, dried botanicals, morning haze",
        "natural":   "forest-filtered light, tactile organic textures",
        "y2k":       "chrome surfaces, holographic plastic, iridescent reflections",
        "chrome":    "glossy reflective surfaces, automotive chrome, dramatic studio light",
        "neon":      "rain-soaked neon-lit Tokyo alleyway at midnight, vivid color bleed",
        "pastel":    "soft diffuse morning light through sheer curtains, gentle color palette",
        "editorial": "stark white studio with single dramatic overhead light, fashion week energy",
        "minimal":   "negative space composition, single object, architectural calm",
    }
    scene = next(
        (v for k, v in scene_map.items() if any(k in w.lower() for w in kw)),
        "atmospheric editorial scene with dramatic art-directed lighting",
    )

    return {
        "mood": mood,
        "voice_words": voice_words,
        "interest_ctx": interest_ctx,
        "obsession": obsession,
        "mindset": mindset,
        "shape_bias": shape_bias,
        "reference": reference,
        "scene": scene,
        "aesthetics_full": ", ".join(kw),
        "product_idea": product_idea,
    }


def _logo_prompt(brand_name: str, product_idea: str, persona: Persona) -> str:
    """Build a rich brand-brief-style logo prompt derived entirely from scraped persona data."""
    b = _persona_brief(persona, product_idea)
    mood_str  = ", ".join(b["mood"])
    voice_str = " and ".join(b["voice_words"])
    ctx_str   = " and ".join(b["interest_ctx"])

    return (
        f"Create a brand logo mark for '{brand_name}', a {product_idea} brand. "
        f"The brand should feel {mood_str}, {voice_str}, "
        f"blending the energy of {ctx_str} "
        f"with the sophistication of a premium creative brand. "
        f"Use a bold experimental visual identity — {b['shape_bias']}. "
        f"The overall mood: inventive, graphic, high-concept, "
        f"with a balance of {b['obsession']} culture and contemporary design. "
        f"Make it feel like a confident brand mark with strong graphic cohesion "
        f"and a premium creative studio aesthetic. "
        f"Inspired by: {b['reference']}. "
        f"Visual world: {b['aesthetics_full']}. "
        f"Single symbol on pure white background. Flat 2D vector. "
        f"Scalable to 16x16px. Centered. "
        f"{_LOGO_INLINE_NEGATIVE}"
    )


def _to_mono(img: Image.Image, color: tuple[int, int, int]) -> Image.Image:
    gray = img.convert("L")
    mask = gray.point(lambda v: 0 if v > 230 else 255)
    out = Image.new("RGBA", img.size, (*color, 0))
    solid = Image.new("RGBA", img.size, (*color, 255))
    out.paste(solid, (0, 0), mask)
    return out


def _make_avatar(mono_light: Image.Image, brand_color_hex: str, size: int = 1024) -> Image.Image:
    bg_rgb = _hex_to_rgb(brand_color_hex)
    canvas = Image.new("RGBA", (size, size), (*bg_rgb, 255))
    logo = mono_light.resize((int(size * 0.7), int(size * 0.7)), Image.LANCZOS)
    offset = (size - logo.size[0]) // 2
    canvas.paste(logo, (offset, offset), logo)
    return canvas


def _make_on_brand(mono_light: Image.Image, brand_color_hex: str) -> Image.Image:
    bg_rgb = _hex_to_rgb(brand_color_hex)
    bg = Image.new("RGBA", mono_light.size, (*bg_rgb, 255))
    return Image.alpha_composite(bg, mono_light)


def _pillow_wordmark(brand_name: str, brand_color_hex: str, size: int = 1024) -> Image.Image:
    """Create a clean branded wordmark when HF is unavailable."""
    bg_rgb = _hex_to_rgb(brand_color_hex)
    # Choose text color with enough contrast
    lum = 0.299 * bg_rgb[0] + 0.587 * bg_rgb[1] + 0.114 * bg_rgb[2]
    text_rgb = (10, 10, 10) if lum > 140 else (245, 245, 240)

    img = Image.new("RGBA", (size, size), (*bg_rgb, 255))
    draw = ImageDraw.Draw(img)

    # Try to load a bundled font, fall back to default
    font_path = _FONTS_DIR / "SpaceGrotesk-Bold.ttf"
    if not font_path.exists():
        font_path = _FONTS_DIR / "Inter-Bold.ttf"

    font_size = max(60, size // max(len(brand_name), 3))
    try:
        font = ImageFont.truetype(str(font_path), font_size)
    except Exception:
        font = ImageFont.load_default()

    # Center the text
    bbox = draw.textbbox((0, 0), brand_name.upper(), font=font)
    w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - w) // 2
    y = (size - h) // 2
    draw.text((x, y), brand_name.upper(), fill=(*text_rgb, 255), font=font)

    return img


async def generate_logo_set(
    brand_name: str,
    product_idea: str,
    persona: Persona,
    brand_color_hex: str,
    job_id: str,
) -> LogoVariants:
    """Generate primary logo via HF if token set, else Pillow wordmark. Derive 4 variants."""
    import logging as _log
    _logger = _log.getLogger(__name__)

    hf_token = get_settings().hf_token
    if hf_token:
        try:
            prompt = _logo_prompt(brand_name, product_idea, persona)
            primary = await _hf_generate(prompt)
            _logger.info("HF logo generated for %s", brand_name)
        except Exception as exc:
            _logger.warning("HF logo generation failed (%s) — using Pillow wordmark", exc)
            primary = _pillow_wordmark(brand_name, brand_color_hex)
    else:
        _logger.info("No HF_TOKEN — using Pillow wordmark for %s", brand_name)
        primary = _pillow_wordmark(brand_name, brand_color_hex)

    mono_dark = _to_mono(primary, (0, 0, 0))
    mono_light = _to_mono(primary, (255, 255, 255))
    on_brand = _make_on_brand(mono_light, brand_color_hex)
    avatar = _make_avatar(mono_light, brand_color_hex)

    urls = await asyncio.gather(
        storage.upload_pil(primary,    "brand-assets", f"jobs/{job_id}/logo_primary.png"),
        storage.upload_pil(mono_dark,  "brand-assets", f"jobs/{job_id}/logo_mono_dark.png"),
        storage.upload_pil(mono_light, "brand-assets", f"jobs/{job_id}/logo_mono_light.png"),
        storage.upload_pil(on_brand,   "brand-assets", f"jobs/{job_id}/logo_on_brand.png"),
        storage.upload_pil(avatar,     "brand-assets", f"jobs/{job_id}/logo_avatar.png"),
    )

    return LogoVariants(
        primary=urls[0], mono_dark=urls[1], mono_light=urls[2],
        on_brand=urls[3], avatar=urls[4],
    )


# ---------------------------------------------------------------------------
# Mockup generation
# ---------------------------------------------------------------------------

_MockupLabel = Literal["tee", "tote", "hat", "sticker"]

_MOCKUP_NEGATIVE = (
    "text, readable letters, watermark, model, mannequin, "
    "graphic design overlays, blurry, low quality, CGI, 3D render"
)


def _mockup_prompt(label: _MockupLabel, persona: Persona, product_idea: str = "") -> tuple[str, int, int]:
    b = _persona_brief(persona, product_idea)
    kw = persona.aesthetic_keywords or ["minimal"]
    mood_str  = ", ".join(b["mood"])
    voice_str = " and ".join(b["voice_words"])
    tee_color, surface = _aesthetic_context(kw)

    base = (
        f"The brand feels {mood_str}, {voice_str}, "
        f"with a sense of product obsession, packaging exploration, and editorial photography. "
        f"Premium creative studio aesthetic. Magazine quality, no people, no text, no logos. "
        f"Visual world: {b['aesthetics_full']}. {b['scene']}."
    )

    if label == "tee":
        return (
            f"Editorial product photograph of a {tee_color} cotton crewneck t-shirt "
            f"with a small minimalist abstract emblem at left chest. "
            f"Flat lay on {surface}. Natural daylight. "
            f"{base}"
        ), 1024, 1024

    if label == "tote":
        hook = "brushed steel hook" if "brutalist" in " ".join(kw).lower() else "wooden peg"
        return (
            f"Editorial product photograph of a premium canvas tote bag hanging on a {hook}. "
            f"Small minimalist abstract emblem on front panel. "
            f"Art-directed still life. Natural daylight. "
            f"{base}"
        ), 1024, 1024

    if label == "hat":
        cap_color = "charcoal" if "dark" in " ".join(kw).lower() else "off-white"
        return (
            f"Editorial product photo of a structured 6-panel {cap_color} cap, "
            f"small embroidered emblem on front. "
            f"Three-quarter angle on {surface}. Natural daylight. "
            f"{base}"
        ), 1024, 1024

    # sticker / default
    return (
        f"Top-down editorial photograph of die-cut vinyl stickers on {surface}. "
        f"Abstract minimalist shapes, glossy finish. "
        f"{base}"
    ), 1024, 1024


async def _generate_mockup_hf(
    label: _MockupLabel, persona: Persona, job_id: str, product_idea: str = ""
) -> Mockup:
    prompt, w, h = _mockup_prompt(label, persona, product_idea)
    img = await _hf_generate(prompt, negative_prompt=_MOCKUP_NEGATIVE, width=w, height=h)
    url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/mockup_{label}.png")
    return Mockup(label=label, url=url)


async def _generate_mockup_canva(
    label: _MockupLabel, persona: Persona, template_id: str, job_id: str
) -> Mockup:
    try:
        data = [
            {"name": "aesthetic", "type": "text", "text": {"text": ", ".join(persona.aesthetic_keywords[:3])}},
            {"name": "product_type", "type": "text", "text": {"text": label}},
        ]
        design_id = await canva.autofill_template(template_id, data, title=f"Halo {label} mockup")
        png_url = await canva.export_design_png(design_id)
        url = await storage.upload_url(png_url, "brand-assets", f"jobs/{job_id}/mockup_{label}.png")
        return Mockup(label=label, url=url)
    except Exception:
        return await _generate_mockup_hf(label, persona, job_id)


async def _generate_mockup_pillow(
    label: _MockupLabel, brand_name: str, brand_color_hex: str, job_id: str
) -> Mockup:
    """Minimal Pillow mockup card when HF is unavailable."""
    bg_rgb = _hex_to_rgb(brand_color_hex)
    lum = 0.299 * bg_rgb[0] + 0.587 * bg_rgb[1] + 0.114 * bg_rgb[2]
    text_rgb = (10, 10, 10) if lum > 140 else (245, 245, 240)
    img = Image.new("RGBA", (1200, 900), (*bg_rgb, 255))
    draw = ImageDraw.Draw(img)
    font_path = _FONTS_DIR / "SpaceGrotesk-Bold.ttf"
    try:
        font_big = ImageFont.truetype(str(font_path), 120) if font_path.exists() else ImageFont.load_default()
        font_sm  = ImageFont.truetype(str(font_path), 40)  if font_path.exists() else ImageFont.load_default()
    except Exception:
        font_big = font_sm = ImageFont.load_default()
    name_upper = brand_name.upper()
    bb = draw.textbbox((0, 0), name_upper, font=font_big)
    draw.text(((1200 - bb[2] + bb[0]) // 2, 340), name_upper, fill=(*text_rgb, 200), font=font_big)
    label_upper = label.upper()
    bb2 = draw.textbbox((0, 0), label_upper, font=font_sm)
    draw.text(((1200 - bb2[2] + bb2[0]) // 2, 500), label_upper, fill=(*text_rgb, 120), font=font_sm)
    url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/mockup_{label}.png")
    return Mockup(label=label, url=url)


async def generate_mockups(
    brand_name: str,
    persona: Persona,
    job_id: str,
    include: list[_MockupLabel] | None = None,
    brand_color_hex: str = "#1a1a1a",
    product_idea: str = "",
) -> list[Mockup]:
    if include is None:
        include = ["tee", "tote"]

    hf_token = get_settings().hf_token
    template_ids = canva.mockup_template_ids() if canva.is_configured() else []
    tasks = []
    for i, label in enumerate(include):
        if template_ids and i < len(template_ids):
            tasks.append(_generate_mockup_canva(label, persona, template_ids[i], job_id))
        elif hf_token:
            tasks.append(_generate_mockup_hf(label, persona, job_id, product_idea=product_idea))
        else:
            tasks.append(_generate_mockup_pillow(label, brand_name, brand_color_hex, job_id))

    return list(await asyncio.gather(*tasks))


# ---------------------------------------------------------------------------
# Social kit
# ---------------------------------------------------------------------------

_SOCIAL_NEGATIVE = "text, overlays, watermarks, logos, blurry, low quality, collage"


def _compose_text_post(
    size: tuple[int, int],
    bg_hex: str,
    logo_img: Image.Image | None,
    text: str | None,
    text_color_hex: str = "#ffffff",
    font_size: int = 80,
    font_family: str | None = None,
) -> Image.Image:
    bg = Image.new("RGB", size, _hex_to_rgb(bg_hex))
    draw = ImageDraw.Draw(bg)
    font = _pick_font(font_size, family=font_family)

    if logo_img:
        logo_size = int(min(size) * 0.4)
        logo = logo_img.resize((logo_size, logo_size), Image.LANCZOS)
        x = (size[0] - logo_size) // 2
        y = (size[1] - logo_size) // 2
        bg.paste(logo, (x, y), logo if logo.mode == "RGBA" else None)

    if text:
        color = _hex_to_rgb(text_color_hex)
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        logo_offset = int(min(size) * 0.25) if logo_img else 0
        draw.text(
            ((size[0] - tw) // 2, (size[1] - th) // 2 + logo_offset),
            text, fill=color, font=font,
        )

    return bg


async def _lifestyle_hf(
    persona: Persona, width: int, height: int, job_id: str, label: str,
    brand_name: str = "", product_idea: str = "", tagline: str = "",
) -> str:
    b = _persona_brief(persona, product_idea)
    mood_str  = ", ".join(b["mood"])
    voice_str = " and ".join(b["voice_words"])
    ctx_str   = " and ".join(b["interest_ctx"])

    is_story = height > width
    framing = "vertical 9:16 story frame, full bleed" if is_story else "square 1:1 editorial frame"

    prompt = (
        f"Atmospheric lifestyle campaign photograph for the brand '{brand_name}'. "
        f"The brand should feel {mood_str}, {voice_str}, "
        f"blending the energy of {ctx_str} "
        f"with the sophistication of a premium creative brand. "
        f"Bold experimental visual identity with {b['aesthetics_full']}. "
        f"Overall mood: inventive, youthful, tactile, high-concept. "
        f"Scene: {b['scene']}. "
        f"Include a sense of: product obsession, visual experimentation, "
        f"editorial photography, immersive retail, cross-platform brand application. "
        f"Make it feel like a confident contemporary brand world — "
        f"accessible yet art-directed, strong graphic cohesion, premium creative studio. "
        f"{framing}. No text. No logos. No people. Magazine quality."
    )
    img = await _hf_generate(prompt, negative_prompt=_SOCIAL_NEGATIVE, width=width, height=height)
    return await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_{label}.png")


async def _social_canva(
    template_id: str, brand_name: str, tagline: str,
    persona: Persona, logo_asset_id: str, job_id: str, label: str,
) -> str:
    data = [
        {"name": "brand_name", "type": "text", "text": {"text": brand_name}},
        {"name": "tagline", "type": "text", "text": {"text": tagline}},
        {"name": "aesthetic", "type": "text", "text": {"text": ", ".join(persona.aesthetic_keywords[:3])}},
        {"name": "logo", "type": "image", "image": {"asset_id": logo_asset_id}},
    ]
    design_id = await canva.autofill_template(template_id, data, title=f"Halo {label}")
    png_url = await canva.export_design_png(design_id)
    return await storage.upload_url(png_url, "brand-assets", f"jobs/{job_id}/social_{label}.png")


async def generate_social_kit(
    brand_name: str,
    tagline: str,
    persona: Persona,
    logo_url: str,
    brand_color_hex: str,
    job_id: str,
    display_font: str | None = None,
) -> list[SocialAsset]:
    """5 social assets: hero + quote + lifestyle (square) + launch + closeup (story)."""
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(logo_url)
            resp.raise_for_status()
        logo_pil: Image.Image | None = Image.open(io.BytesIO(resp.content)).convert("RGBA")
    except Exception:
        logo_pil = None

    canva_logo_asset_id: str | None = None
    social_templates = canva.social_template_ids() if canva.is_configured() else []
    if social_templates and logo_pil:
        try:
            buf = io.BytesIO()
            logo_pil.save(buf, format="PNG")
            canva_logo_asset_id = await canva.upload_asset(buf.getvalue(), f"{brand_name}_logo.png")
        except Exception:
            pass

    bg_rgb = _hex_to_rgb(brand_color_hex)
    is_dark = sum(bg_rgb) / 3 < 128
    text_hex = "#ffffff" if is_dark else "#000000"

    async def _hero() -> SocialAsset:
        img = _compose_text_post((1080, 1080), brand_color_hex, logo_pil, None)
        url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_ig_post_hero.png")
        return SocialAsset(label="ig_post_hero", url=url, format="ig_square")

    async def _quote() -> SocialAsset:
        img = _compose_text_post((1080, 1080), text_hex, None, tagline,
                                 text_color_hex=brand_color_hex, font_size=72,
                                 font_family=display_font)
        url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_ig_post_quote.png")
        return SocialAsset(label="ig_post_quote", url=url, format="ig_square")

    async def _lifestyle() -> SocialAsset:
        if social_templates and canva_logo_asset_id:
            try:
                url = await _social_canva(social_templates[0], brand_name, tagline,
                                          persona, canva_logo_asset_id, job_id, "ig_post_lifestyle")
                return SocialAsset(label="ig_post_lifestyle", url=url, format="ig_square")
            except Exception:
                pass
        hf_tok = get_settings().hf_token
        if hf_tok:
            try:
                url = await _lifestyle_hf(persona, 1024, 1024, job_id, "ig_post_lifestyle",
                                          brand_name=brand_name, product_idea="", tagline=tagline)
                return SocialAsset(label="ig_post_lifestyle", url=url, format="ig_square")
            except Exception:
                pass
        # Pillow fallback — aesthetic keywords as text overlay
        kw_text = " · ".join(persona.aesthetic_keywords[:3]) if persona.aesthetic_keywords else tagline
        img = _compose_text_post((1080, 1080), brand_color_hex, logo_pil, kw_text,
                                 text_color_hex=text_hex, font_size=60)
        url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_ig_post_lifestyle.png")
        return SocialAsset(label="ig_post_lifestyle", url=url, format="ig_square")

    async def _story_launch() -> SocialAsset:
        if social_templates and len(social_templates) > 1 and canva_logo_asset_id:
            try:
                url = await _social_canva(social_templates[1], brand_name, "COMING SOON",
                                          persona, canva_logo_asset_id, job_id, "ig_story_launch")
                return SocialAsset(label="ig_story_launch", url=url, format="ig_story")
            except Exception:
                pass
        img = _compose_text_post((1080, 1920), brand_color_hex, logo_pil, "COMING SOON",
                                 text_color_hex=text_hex, font_size=90,
                                 font_family=display_font)
        url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_ig_story_launch.png")
        return SocialAsset(label="ig_story_launch", url=url, format="ig_story")

    async def _story_closeup() -> SocialAsset:
        hf_tok = get_settings().hf_token
        if hf_tok:
            try:
                url = await _lifestyle_hf(persona, 768, 1344, job_id, "ig_story_closeup",
                                          brand_name=brand_name, product_idea="", tagline=tagline)
                return SocialAsset(label="ig_story_closeup", url=url, format="ig_story")
            except Exception:
                pass
        # Pillow fallback — tall story card with tagline
        img = _compose_text_post((1080, 1920), brand_color_hex, logo_pil, tagline[:40],
                                 text_color_hex=text_hex, font_size=80,
                                 font_family=display_font)
        url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/social_ig_story_closeup.png")
        return SocialAsset(label="ig_story_closeup", url=url, format="ig_story")

    return list(await asyncio.gather(_hero(), _quote(), _lifestyle(), _story_launch(), _story_closeup()))
