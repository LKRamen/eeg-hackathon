"""Go-To-Market kit generator — outputs a complete brand package into Canva.

What gets created in the user's Canva account:
  1. Asset folder  "{brand_name} — Halo GTM Kit"
       logo_primary.png, logo_mono_dark.png, logo_on_brand.png, logo_avatar.png
       mockup_tee.png, mockup_tote.png (if available)
       social_ig_post_hero.png, social_ig_post_lifestyle.png, social_ig_post_quote.png

  2. Eight blank designs (correct dimensions, ready to drag assets into):
       ig_post_1  / ig_post_2 / ig_post_3       — 1080x1080 Instagram posts
       ig_story_1 / ig_story_2                  — 1080x1920 Instagram stories
       brand_deck                                — 1920x1080 pitch presentation
       linkedin_announcement                     — LinkedIn post
       email_header                              — Email campaign header

If autofill templates are configured (CANVA_SOCIAL_TEMPLATE_IDS), the social
designs are filled automatically. Otherwise the user gets blank canvases the
right size with all assets pre-loaded in their account.

Usage (called from the pipeline after all assets are generated):
    from services.gtm_canva import build_gtm_kit
    kit = await build_gtm_kit(brand_result, logo_variants, mockups, social_assets)
"""

from __future__ import annotations

import asyncio
import io
from dataclasses import dataclass, field

from pydantic import BaseModel

from ..models.schemas import BrandResult, LogoVariants, Mockup, Persona, SocialAsset
from . import canva


# ---------------------------------------------------------------------------
# Output types
# ---------------------------------------------------------------------------

class GTMDesign(BaseModel):
    label: str
    format: str
    canva_design_id: str
    edit_url: str
    view_url: str


class GTMCanvaKit(BaseModel):
    brand_name: str
    asset_folder_id: str
    asset_folder_url: str
    uploaded_asset_ids: dict[str, str]    # label → canva asset ID
    designs: list[GTMDesign]

    @property
    def edit_urls(self) -> dict[str, str]:
        return {d.label: d.edit_url for d in self.designs}


# ---------------------------------------------------------------------------
# GTM design spec
# ---------------------------------------------------------------------------

@dataclass
class _DesignSpec:
    label: str
    preset: str       # key into canva._PRESETS
    fmt: str          # human-readable format
    title_template: str   # {brand_name} is substituted


_GTM_DESIGNS: list[_DesignSpec] = [
    _DesignSpec("ig_post_brand",      "ig_square",    "1080x1080", "{brand_name} — Brand Announcement"),
    _DesignSpec("ig_post_product",    "ig_square",    "1080x1080", "{brand_name} — Product Post"),
    _DesignSpec("ig_post_quote",      "ig_square",    "1080x1080", "{brand_name} — Brand Voice"),
    _DesignSpec("ig_story_launch",    "ig_story",     "1080x1920", "{brand_name} — Launch Story"),
    _DesignSpec("ig_story_atmosphere","ig_story",     "1080x1920", "{brand_name} — Atmosphere Story"),
    _DesignSpec("brand_deck",         "presentation", "1920x1080", "{brand_name} — Brand Deck"),
    _DesignSpec("linkedin_announce",  "linkedin",     "1200x627",  "{brand_name} — LinkedIn Launch"),
    _DesignSpec("email_header",       "email_header", "600x200",   "{brand_name} — Email Header"),
]


# ---------------------------------------------------------------------------
# Asset upload helpers
# ---------------------------------------------------------------------------

async def _upload_asset_from_url(url: str, name: str) -> str | None:
    """Download a Supabase-hosted image and upload it to Canva. Returns asset ID."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(url)
            resp.raise_for_status()
            image_bytes = resp.content
        return await canva.upload_asset(image_bytes, name)
    except Exception as e:
        print(f"  [gtm] asset upload skipped ({name}): {e}")
        return None


async def _upload_asset_from_pil_bytes(image_bytes: bytes, name: str) -> str | None:
    try:
        return await canva.upload_asset(image_bytes, name)
    except Exception as e:
        print(f"  [gtm] asset upload skipped ({name}): {e}")
        return None


# ---------------------------------------------------------------------------
# Main builder
# ---------------------------------------------------------------------------

async def build_gtm_kit(
    brand_name: str,
    persona: Persona,
    logo_variants: LogoVariants,
    mockups: list[Mockup],
    social_assets: list[SocialAsset],
) -> GTMCanvaKit:
    """Build a complete GTM kit in Canva. Returns kit with all design URLs.

    Steps:
      1. Create an asset folder.
      2. Upload all brand images to Canva (parallel).
      3. Organise uploads into the folder (parallel).
      4. Create blank designs for each GTM format (parallel).
      5. Return GTMCanvaKit with folder URL and all edit links.
    """
    if not canva.is_configured():
        raise RuntimeError(
            "Canva is not configured. Set CANVA_CLIENT_ID and CANVA_CLIENT_SECRET."
        )

    print(f"[gtm] Building Canva GTM kit for '{brand_name}'...")

    # ── 1. Create asset folder ───────────────────────────────────────────────
    folder_name = f"{brand_name} — Halo GTM Kit"
    folder_id = await canva.create_asset_folder(folder_name)
    folder_url = f"https://www.canva.com/folder/{folder_id}"
    print(f"[gtm] folder created: {folder_url}")

    # ── 2. Upload brand assets in parallel ──────────────────────────────────
    upload_tasks: dict[str, asyncio.Task] = {}

    async def _schedule(key: str, url: str, name: str) -> tuple[str, str | None]:
        asset_id = await _upload_asset_from_url(url, name)
        return key, asset_id

    coroutines = [
        _schedule("logo_primary",    logo_variants.primary,    f"{brand_name}_logo_primary.png"),
        _schedule("logo_mono_dark",  logo_variants.mono_dark,  f"{brand_name}_logo_mono_dark.png"),
        _schedule("logo_mono_light", logo_variants.mono_light, f"{brand_name}_logo_mono_light.png"),
        _schedule("logo_on_brand",   logo_variants.on_brand,   f"{brand_name}_logo_on_brand.png"),
        _schedule("logo_avatar",     logo_variants.avatar,     f"{brand_name}_logo_avatar.png"),
    ]

    for m in mockups:
        coroutines.append(_schedule(f"mockup_{m.label}", m.url, f"{brand_name}_mockup_{m.label}.png"))

    for s in social_assets:
        coroutines.append(_schedule(f"social_{s.label}", s.url, f"{brand_name}_{s.label}.png"))

    upload_results = await asyncio.gather(*coroutines)
    uploaded: dict[str, str] = {k: v for k, v in upload_results if v}
    print(f"[gtm] {len(uploaded)}/{len(coroutines)} assets uploaded to Canva")

    # ── 3. Move assets into folder ──────────────────────────────────────────
    folder_tasks = [
        canva.add_asset_to_folder(asset_id, folder_id)
        for asset_id in uploaded.values()
    ]
    await asyncio.gather(*folder_tasks, return_exceptions=True)
    print(f"[gtm] assets organised into folder")

    # ── 4. Create blank designs in parallel ─────────────────────────────────
    async def _make_design(spec: _DesignSpec) -> GTMDesign:
        title = spec.title_template.format(brand_name=brand_name)
        try:
            result = await canva.create_design(spec.preset, title)
            return GTMDesign(
                label=spec.label,
                format=spec.fmt,
                canva_design_id=result["id"],
                edit_url=result["edit_url"],
                view_url=result["view_url"],
            )
        except Exception as e:
            print(f"  [gtm] design creation failed ({spec.label}): {e}")
            return GTMDesign(
                label=spec.label,
                format=spec.fmt,
                canva_design_id="",
                edit_url="",
                view_url="",
            )

    designs = list(await asyncio.gather(*[_make_design(s) for s in _GTM_DESIGNS]))
    ok_designs = [d for d in designs if d.canva_design_id]
    print(f"[gtm] {len(ok_designs)}/{len(_GTM_DESIGNS)} designs created")

    return GTMCanvaKit(
        brand_name=brand_name,
        asset_folder_id=folder_id,
        asset_folder_url=folder_url,
        uploaded_asset_ids=uploaded,
        designs=designs,
    )


# ---------------------------------------------------------------------------
# Pretty-print helper (for CLI / test output)
# ---------------------------------------------------------------------------

def print_kit(kit: GTMCanvaKit) -> None:
    print(f"\n{'='*60}")
    print(f"  {kit.brand_name} — Canva GTM Kit")
    print(f"{'='*60}")
    print(f"\nAsset folder ({len(kit.uploaded_asset_ids)} assets):")
    print(f"  {kit.asset_folder_url}")
    print(f"\nDesigns:")
    for d in kit.designs:
        status = d.edit_url if d.edit_url else "[FAILED]"
        print(f"  {d.label:<25} {d.format:<12}  {status}")
    print()
