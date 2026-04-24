from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from apps.api.models.schemas import BrandAssets, Persona

from . import _storage as storage
from ._export_deck import build_pitch_deck, render_pitch_deck_html
from ._export_mfg import build_mfg_spec, render_mfg_spec_html
from ._export_web import build_web_guide, render_web_guide_html
from ._export_zip import build_brand_kit_zip
from ._palette import contrast_ratio
from ._template_helpers import jinja_env, palette_tokens, render_pdf

__all__ = [
    "build_brand_guide",
    "build_pitch_deck",
    "build_web_guide",
    "build_mfg_spec",
    "build_brand_kit_zip",
    "render_brand_guide_html",
    "render_pitch_deck_html",
    "render_web_guide_html",
    "render_mfg_spec_html",
]

logger = logging.getLogger(__name__)


def _body_contrast(brand: BrandAssets) -> Optional[str]:
    tokens = palette_tokens(brand)
    return f"{contrast_ratio(tokens['bg'], tokens['fg']):.1f}"


def render_brand_guide_html(brand: BrandAssets, persona: Persona) -> str:
    template = jinja_env().get_template("brand_guide.html")
    return template.render(
        brand=brand,
        persona=persona,
        tokens=palette_tokens(brand),
        contrast_ratio=_body_contrast(brand),
        date=dt.date.today().isoformat(),
    )


async def build_brand_guide(
    brand: BrandAssets, persona: Persona, job_id: str
) -> str:
    """Render and upload the 9-page brand guide PDF.

    On hosts where WeasyPrint can't render (no GTK3), falls back to
    uploading the raw HTML so the pipeline still produces an artifact.
    Caller treats the returned URL as the brand_guide_pdf_url.
    """
    html = render_brand_guide_html(brand, persona)
    pdf = render_pdf(html)

    if pdf is not None:
        return await storage.upload_image(
            pdf,
            "brand-guides",
            f"jobs/{job_id}/brand_guide.pdf",
            content_type="application/pdf",
        )

    logger.info("falling back to HTML for job_id=%s", job_id)
    return await storage.upload_image(
        html.encode("utf-8"),
        "brand-guides",
        f"jobs/{job_id}/brand_guide.html",
        content_type="text/html",
    )
