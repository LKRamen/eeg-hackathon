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


def _logo_prompt(brand_name: str, product_idea: str, persona: Persona) -> str:
    """Build a logo prompt per task 3.2 spec.

    Key principles applied:
    - Inline NEGATIVE section (FLUX ignores negative_prompt parameter)
    - Keyword-specific historical reference for visual specificity
    - Keyword-specific shape bias to prevent generic swirl/loop output
    - 16x16px scalability requirement
    """
    kw = persona.aesthetic_keywords

    # Pick the most specific historical reference from the first matching keyword
    reference = next(
        (ref for k, ref in _KEYWORD_REFERENCES.items()
         if any(k in w.lower() for w in kw)),
        "1960s Swiss International Style and Saul Bass film poster identity design",
    )

    # Pick shape bias from the first matching keyword
    shape_bias = next(
        (shape for k, shape in _KEYWORD_SHAPE.items()
         if any(k in w.lower() for w in kw)),
        "single bold geometric shape, strong silhouette",
    )

    aesthetics = ", ".join(kw)

    return (
        f"Iconic minimalist vector logo mark for the brand '{brand_name}'. "
        f"The brand makes: {product_idea}. "
        f"Visual aesthetic: {aesthetics}. "
        f"Shape: {shape_bias}. "
        f"A single symbol — not literal, not illustrative. "
        f"Solid color on pure white background. Centered. "
        f"Designed for scaling: must read clearly at 16x16 pixels. "
        f"Inspired by: {reference}. "
        f"Also inspired by: early MTV bumpers, Saul Bass film titles. "
        f"Clean vector art, flat 2D, single color on white. "
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


async def generate_logo_set(
    brand_name: str,
    product_idea: str,
    persona: Persona,
    brand_color_hex: str,
    job_id: str,
) -> LogoVariants:
    """Generate primary logo via HF, derive 4 variants with Pillow, upload all."""
    prompt = _logo_prompt(brand_name, product_idea, persona)
    primary = await _hf_generate(prompt)  # negatives are inline for FLUX compatibility

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


def _mockup_prompt(label: _MockupLabel, persona: Persona) -> tuple[str, int, int]:
    kw = persona.aesthetic_keywords
    tee_color, surface = _aesthetic_context(kw)

    if label == "tee":
        return (
            f"Editorial product photograph of a {tee_color} cotton crewneck t-shirt, "
            f"{kw[0] if kw else 'minimal'} aesthetic. "
            f"Small minimalist abstract emblem at left chest. "
            f"Flat lay on {surface}. Natural daylight, magazine quality. No people."
        ), 1024, 1024

    if label == "tote":
        hook = "brushed steel hook" if "brutalist" in " ".join(kw).lower() else "wooden peg"
        return (
            f"Editorial product photograph of a canvas tote bag on a {hook}, "
            f"{kw[0] if kw else 'minimal'} aesthetic. "
            f"Small minimalist abstract emblem on front. Natural daylight, magazine quality."
        ), 1024, 1024

    if label == "hat":
        cap_color = "charcoal" if "dark" in " ".join(kw).lower() else "off-white"
        return (
            f"Editorial product photo of a structured 6-panel {cap_color} cap, "
            f"{kw[0] if kw else 'minimal'} aesthetic. Small embroidered emblem on front. "
            f"Side angle on {surface}, no model, natural daylight."
        ), 1024, 1024

    return (
        f"Top-down photo of die-cut vinyl stickers on {surface}, "
        f"abstract minimalist shapes, {kw[0] if kw else 'minimal'} aesthetic. "
        f"Glossy finish, magazine quality."
    ), 1024, 1024


async def _generate_mockup_hf(label: _MockupLabel, persona: Persona, job_id: str) -> Mockup:
    prompt, w, h = _mockup_prompt(label, persona)
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


async def generate_mockups(
    brand_name: str,
    persona: Persona,
    job_id: str,
    include: list[_MockupLabel] | None = None,
) -> list[Mockup]:
    if include is None:
        include = ["tee", "tote"]

    template_ids = canva.mockup_template_ids() if canva.is_configured() else []
    tasks = []
    for i, label in enumerate(include):
        if template_ids and i < len(template_ids):
            tasks.append(_generate_mockup_canva(label, persona, template_ids[i], job_id))
        else:
            tasks.append(_generate_mockup_hf(label, persona, job_id))

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


async def _lifestyle_hf(persona: Persona, width: int, height: int, job_id: str, label: str) -> str:
    kw = persona.aesthetic_keywords
    scene_map = {
        "brutalist": "raw concrete cityscape at dusk",
        "organic": "sun-drenched linen and dried botanicals",
        "y2k": "chrome surfaces with holographic reflections",
        "neon": "rain-soaked neon-lit alleyway at night",
        "pastel": "soft morning light through sheer curtains",
    }
    scene = next(
        (v for k, v in scene_map.items() if any(k in w.lower() for w in kw)),
        "atmospheric editorial scene",
    )
    prompt = (
        f"Atmospheric lifestyle photograph, {kw[0] if kw else 'minimal'} aesthetic. "
        f"{scene}. Editorial composition, magazine quality, natural light."
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
        url = await _lifestyle_hf(persona, 1024, 1024, job_id, "ig_post_lifestyle")
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
        url = await _lifestyle_hf(persona, 768, 1344, job_id, "ig_story_closeup")
        return SocialAsset(label="ig_story_closeup", url=url, format="ig_story")

    return list(await asyncio.gather(_hero(), _quote(), _lifestyle(), _story_launch(), _story_closeup()))
