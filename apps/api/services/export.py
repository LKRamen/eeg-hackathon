from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from apps.api.models.schemas import BrandAssets, Persona

from . import _storage as storage
from ._export_deck import build_pitch_deck, render_pitch_deck_html
from ._export_mfg import build_mfg_spec, render_mfg_spec_html
from ._export_web import build_web_guide, render_web_guide_html
from ._export_zip import build_brand_kit_zip
from ._palette import contrast_ratio

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

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
_BASE_CSS = _TEMPLATES_DIR / "_base.css"


def _jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


_DEFAULT_TOKENS: dict[str, str] = {
    "primary": "#0a0a0a",
    "secondary": "#f5f1e8",
    "accent": "#c2410c",
    "bg": "#ffffff",
    "fg": "#0a0a0a",
}


def _palette_tokens(brand: BrandAssets) -> dict[str, str]:
    """Resolve a hex value for every role, falling back to safe defaults
    when the palette is partial. Keeps Jinja templates simple and
    crash-free."""
    by_role = {c.role: c.hex for c in brand.palette}
    return {role: by_role.get(role, default) for role, default in _DEFAULT_TOKENS.items()}


def _body_contrast(brand: BrandAssets) -> Optional[str]:
    tokens = _palette_tokens(brand)
    return f"{contrast_ratio(tokens['bg'], tokens['fg']):.1f}"


def render_brand_guide_html(brand: BrandAssets, persona: Persona) -> str:
    env = _jinja_env()
    template = env.get_template("brand_guide.html")
    return template.render(
        brand=brand,
        persona=persona,
        tokens=_palette_tokens(brand),
        contrast_ratio=_body_contrast(brand),
        date=dt.date.today().isoformat(),
    )


def _render_pdf(html: str) -> Optional[bytes]:
    """Render HTML to PDF via WeasyPrint. Returns None when GTK3 missing."""
    try:
        import weasyprint  # imported lazily so missing GTK doesn't break import
    except Exception as exc:
        logger.warning("WeasyPrint import failed: %s", exc)
        return None

    try:
        css_paths = [str(_BASE_CSS)] if _BASE_CSS.exists() else []
        return weasyprint.HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf(
            stylesheets=[weasyprint.CSS(filename=p) for p in css_paths]
        )
    except OSError as exc:
        logger.warning(
            "WeasyPrint render failed (GTK3 runtime likely missing): %s", exc
        )
        return None


async def build_brand_guide(
    brand: BrandAssets, persona: Persona, job_id: str
) -> str:
    """Render and upload the 9-page brand guide PDF.

    On hosts where WeasyPrint can't render (no GTK3), falls back to
    uploading the raw HTML so the pipeline still produces an artifact.
    Caller treats the returned URL as the brand_guide_pdf_url.
    """
    html = render_brand_guide_html(brand, persona)
    pdf = _render_pdf(html)

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
