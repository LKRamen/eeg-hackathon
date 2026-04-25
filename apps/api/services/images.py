from __future__ import annotations

"""Visual asset generation.

Image generation strategy:
  All AI images → Cloudflare Workers AI (FLUX.1-schnell)
                  Endpoint: /accounts/{CF_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell
                  Auth: Bearer CF_API_TOKEN
                  Returns raw image bytes.

  Logo primary   → CF text-to-image → PIL Image
  Logo variants  → Pillow processing (mono, on-brand, avatar) — free, instant
  Mockups        → Canva autofill if templates configured, else CF text-to-image
  Social kit     → CF for lifestyle/story imagery; Pillow composition for hero/quote

All images are rehosted in Supabase storage before returning URLs.
"""

import asyncio
import base64
import io
import logging
from pathlib import Path
from typing import Literal

import httpx
from PIL import Image, ImageDraw, ImageFont

_log = logging.getLogger(__name__)

from ..config import get_settings
from ..models.schemas import LogoVariants, Mockup, Persona, SocialAsset
from . import canva, storage

# ---------------------------------------------------------------------------
# Cloudflare Workers AI client
# ---------------------------------------------------------------------------

_CF_MODEL = "@cf/black-forest-labs/flux-1-schnell"


async def _cf_generate(
    prompt: str,
    negative_prompt: str = "",  # FLUX ignores negative_prompt; kept for call-site compat
    width: int = 1024,
    height: int = 1024,
) -> Image.Image:
    """Run text-to-image via Cloudflare Workers AI (FLUX.1-schnell), return PIL Image.

    CF Workers AI REST API returns a JSON envelope:
      {"result": {"image": "<base64 PNG>"}, "success": true, ...}
    This function handles both that format and raw-bytes responses defensively.
    """
    settings = get_settings()
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/"
        f"{settings.cf_account_id}/ai/run/{_CF_MODEL}"
    )
    body: dict = {"prompt": prompt, "num_steps": 4, "width": width, "height": height}

    _log.info("CF generate → %s  w=%d h=%d  prompt=%.80s…", _CF_MODEL, width, height, prompt)

    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            url,
            json=body,
            headers={"Authorization": f"Bearer {settings.cf_api_token}"},
        )

    _log.info("CF response: status=%d content-type=%s len=%d",
              resp.status_code, resp.headers.get("content-type"), len(resp.content))

    if not resp.is_success:
        _log.error("CF API error body: %s", resp.text[:400])
        resp.raise_for_status()

    content_type = resp.headers.get("content-type", "")
    if "json" in content_type or resp.content[:1] == b"{":
        # JSON envelope: {"result": {"image": "<base64>"}, "success": true}
        data = resp.json()
        if not data.get("success", True):
            raise RuntimeError(f"CF API returned success=false: {data.get('errors')}")
        b64 = (data.get("result") or {}).get("image") or data.get("image", "")
        if not b64:
            raise RuntimeError(f"CF API JSON had no image field: {list(data.keys())}")
        img_bytes = base64.b64decode(b64)
        _log.info("CF image decoded from base64, %d bytes", len(img_bytes))
    else:
        # Raw binary response
        img_bytes = resp.content
        _log.info("CF image received as raw bytes, %d bytes", len(img_bytes))

    return Image.open(io.BytesIO(img_bytes)).convert("RGBA")


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
    """Build a logo prompt that produces premium geometric icon marks."""
    kw = persona.aesthetic_keywords

    reference = next(
        (ref for k, ref in _KEYWORD_REFERENCES.items()
         if any(k in w.lower() for w in kw)),
        "1960s Swiss International Style and Saul Bass film poster identity design",
    )

    shape_bias = next(
        (shape for k, shape in _KEYWORD_SHAPE.items()
         if any(k in w.lower() for w in kw)),
        "single bold geometric shape, strong silhouette",
    )

    aesthetics = ", ".join(kw)

    return (
        f"Minimal geometric icon mark, vector-clean, single color on pure white background. "
        f"Brand: '{brand_name}'. Product: {product_idea}. "
        f"No text, no letters, no letterforms. "
        f"Bold abstract shape — {shape_bias}. "
        f"Premium creative brand aesthetic: {aesthetics}. "
        f"Centered composition, maximum negative space, scalable to 16x16px. "
        f"Inspired by {reference}. "
        f"Designed for a brand identity system — not a product illustration. "
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
    """Generate primary logo via Cloudflare Workers AI if credentials set, else Pillow wordmark."""
    settings = get_settings()
    if settings.cf_account_id and settings.cf_api_token:
        try:
            prompt = _logo_prompt(brand_name, product_idea, persona)
            primary = await _cf_generate(prompt)
            _log.info("CF logo generated for %s", brand_name)
        except Exception as exc:
            _log.warning("CF logo generation failed — using Pillow wordmark. Error: %s", exc, exc_info=True)
            primary = _pillow_wordmark(brand_name, brand_color_hex)
    else:
        _log.info("No CF credentials — using Pillow wordmark for %s", brand_name)
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
    "text, readable letters, watermark, mannequin, "
    "busy background, blurry, low quality, amateur photography, stock photo"
)


def _mockup_prompt(
    label: _MockupLabel,
    persona: Persona,
    brand_color_hex: str = "#1a1a1a",
) -> tuple[str, int, int]:
    kw = persona.aesthetic_keywords
    kw_str = kw[0] if kw else "minimal"
    _, surface = _aesthetic_context(kw)

    if label == "tee":
        return (
            f"Oversized premium t-shirt, flat lay editorial product photography. "
            f"Dark studio background, {kw_str} aesthetic. "
            f"Small minimalist abstract emblem at left chest. "
            f"Colored gel lighting in {brand_color_hex} and complementary tones. "
            f"Surreal composition, high-end streetwear brand campaign. "
            f"4k photorealistic, magazine quality, Dazed & Confused aesthetic. "
            f"No people, no models."
        ), 1024, 1024

    if label == "tote":
        return (
            f"Minimal canvas tote bag floating product shot. "
            f"Brand color {brand_color_hex}, gradient background from dark to {kw_str}. "
            f"Editorial photography, premium creative studio. "
            f"Soft dramatic shadows, slightly surreal composition. "
            f"4k photorealistic, i-D magazine aesthetic. "
            f"No people, no models."
        ), 1024, 1024

    if label == "hat":
        return (
            f"Structured premium cap, side profile editorial product photography. "
            f"{kw_str} aesthetic, dark studio environment. "
            f"Small embroidered emblem on front panel. "
            f"Dramatic directional lighting, magazine quality. 4k photorealistic."
        ), 1024, 1024

    return (
        f"Top-down product shot of premium branded merchandise on {surface}. "
        f"{kw_str} aesthetic, editorial photography, soft natural light. "
        f"Magazine quality, 4k photorealistic."
    ), 1024, 1024


async def _generate_mockup_cf(
    label: _MockupLabel,
    persona: Persona,
    job_id: str,
    brand_color_hex: str = "#1a1a1a",
) -> Mockup:
    prompt, w, h = _mockup_prompt(label, persona, brand_color_hex)
    img = await _cf_generate(prompt, negative_prompt=_MOCKUP_NEGATIVE, width=w, height=h)
    url = await storage.upload_pil(img, "brand-assets", f"jobs/{job_id}/mockup_{label}.png")
    return Mockup(label=label, url=url)


async def _generate_mockup_canva(
    label: _MockupLabel, persona: Persona, template_id: str, job_id: str,
    brand_color_hex: str = "#1a1a1a",
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
        return await _generate_mockup_cf(label, persona, job_id, brand_color_hex)


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
) -> list[Mockup]:
    if include is None:
        include = ["tee", "tote"]

    settings = get_settings()
    template_ids = canva.mockup_template_ids() if canva.is_configured() else []
    tasks = []
    for i, label in enumerate(include):
        if template_ids and i < len(template_ids):
            tasks.append(_generate_mockup_canva(label, persona, template_ids[i], job_id, brand_color_hex))
        elif settings.cf_account_id and settings.cf_api_token:
            tasks.append(_generate_mockup_cf(label, persona, job_id, brand_color_hex))
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


async def _lifestyle_cf(persona: Persona, width: int, height: int, job_id: str, label: str) -> str:
    kw = persona.aesthetic_keywords
    kw_str = kw[0] if kw else "minimal"
    scene_map = {
        "brutalist": "raw concrete brutalist architecture, dramatic shadows",
        "concrete": "raw concrete brutalist architecture, dramatic shadows",
        "organic": "sun-drenched natural linen and dried botanicals, warm light",
        "y2k": "chrome surfaces, holographic reflections, iridescent light",
        "neon": "rain-soaked neon-lit alleyway at night, colored gel reflections",
        "pastel": "soft morning light, sheer curtains, airy studio",
        "editorial": "high-fashion editorial environment, colored lighting gels",
        "tokyo": "Tokyo street at night, neon signs, cinematic atmosphere",
    }
    scene = next(
        (v for k, v in scene_map.items() if any(k in w.lower() for w in kw)),
        "atmospheric urban environment, colored gel lighting",
    )
    prompt = (
        f"Fashion editorial photography, creative professional, {kw_str} aesthetic. "
        f"{scene}. Slightly surreal high-concept composition. "
        f"i-D magazine aesthetic, brand campaign quality. "
        f"4k photorealistic, cinematic color grading, intentional negative space."
    )
    img = await _cf_generate(prompt, negative_prompt=_SOCIAL_NEGATIVE, width=width, height=height)
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
        cf = get_settings()
        if cf.cf_account_id and cf.cf_api_token:
            try:
                url = await _lifestyle_cf(persona, 1024, 1024, job_id, "ig_post_lifestyle")
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
        cf = get_settings()
        if cf.cf_account_id and cf.cf_api_token:
            try:
                url = await _lifestyle_cf(persona, 768, 1344, job_id, "ig_story_closeup")
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
