"""Shared template/render helpers for every export builder.

After the swarm pattern in Phase 1/3 (where each agent kept its own copy
of these helpers to avoid cross-file dependencies), this module
consolidates them now that the swarms are merged. Every export builder
(brand guide, pitch deck, web guide, mfg spec) imports from here.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from apps.api.models.schemas import BrandAssets

logger = logging.getLogger(__name__)

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"
BASE_CSS = TEMPLATES_DIR / "_base.css"

DEFAULT_TOKENS: dict[str, str] = {
    "primary": "#0a0a0a",
    "secondary": "#f5f1e8",
    "accent": "#c2410c",
    "bg": "#ffffff",
    "fg": "#0a0a0a",
}


def palette_tokens(brand: BrandAssets) -> dict[str, str]:
    """Resolve a hex value for every CSS palette role with safe defaults."""
    by_role = {c.role: c.hex for c in brand.palette}
    return {role: by_role.get(role, default) for role, default in DEFAULT_TOKENS.items()}


def jinja_env() -> Environment:
    return Environment(
        loader=FileSystemLoader(str(TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )


def render_pdf(html: str, *, use_base_css: bool = True) -> Optional[bytes]:
    """Render HTML to PDF via WeasyPrint. Returns None on import/render failure
    so callers can fall back to uploading the raw HTML when GTK runtime is
    missing on the host."""
    try:
        import weasyprint
    except Exception as exc:
        logger.warning("WeasyPrint import failed: %s", exc)
        return None
    try:
        stylesheets = []
        if use_base_css and BASE_CSS.exists():
            stylesheets.append(weasyprint.CSS(filename=str(BASE_CSS)))
        return weasyprint.HTML(string=html, base_url=str(TEMPLATES_DIR)).write_pdf(
            stylesheets=stylesheets
        )
    except OSError as exc:
        logger.warning("WeasyPrint render failed: %s", exc)
        return None
