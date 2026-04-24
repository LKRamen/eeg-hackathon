from __future__ import annotations

import datetime as dt
import logging
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from apps.api.models.schemas import AgencyMatch, BrandAssets, Persona

from . import _storage as storage

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
_BASE_CSS = _TEMPLATES_DIR / "_base.css"

_DEFAULT_TOKENS: dict[str, str] = {
    "primary": "#0a0a0a",
    "secondary": "#f5f1e8",
    "accent": "#c2410c",
    "bg": "#ffffff",
    "fg": "#0a0a0a",
}


def _palette_tokens(brand: BrandAssets) -> dict[str, str]:
    by_role = {c.role: c.hex for c in brand.palette}
    return {role: by_role.get(role, default) for role, default in _DEFAULT_TOKENS.items()}


def render_pitch_deck_html(
    brand: BrandAssets, persona: Persona, agency_match: Optional[AgencyMatch] = None
) -> str:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("pitch_deck.html")
    return template.render(
        brand=brand,
        persona=persona,
        agency_match=agency_match,
        tokens=_palette_tokens(brand),
        date=dt.date.today().isoformat(),
    )


def _render_pdf(html: str) -> Optional[bytes]:
    try:
        import weasyprint
    except Exception as exc:
        logger.warning("WeasyPrint import failed: %s", exc)
        return None
    try:
        css_paths = [str(_BASE_CSS)] if _BASE_CSS.exists() else []
        return weasyprint.HTML(string=html, base_url=str(_TEMPLATES_DIR)).write_pdf(
            stylesheets=[weasyprint.CSS(filename=p) for p in css_paths]
        )
    except OSError as exc:
        logger.warning("WeasyPrint render failed: %s", exc)
        return None


async def build_pitch_deck(
    brand: BrandAssets,
    persona: Persona,
    agency_match: Optional[AgencyMatch],
    job_id: str,
) -> str:
    """Render the 5-slide landscape pitch deck PDF (HTML fallback when no GTK)."""
    html = render_pitch_deck_html(brand, persona, agency_match)
    pdf = _render_pdf(html)

    if pdf is not None:
        return await storage.upload_image(
            pdf,
            "brand-guides",
            f"jobs/{job_id}/pitch_deck.pdf",
            content_type="application/pdf",
        )

    return await storage.upload_image(
        html.encode("utf-8"),
        "brand-guides",
        f"jobs/{job_id}/pitch_deck.html",
        content_type="text/html",
    )
