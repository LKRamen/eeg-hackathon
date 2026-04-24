from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from jinja2 import Environment, FileSystemLoader, select_autoescape

from apps.api.models.schemas import BrandAssets, Persona

from . import _storage as storage

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

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


def render_web_guide_html(
    brand: BrandAssets,
    persona: Persona,
    downloads: Optional[dict[str, str]] = None,
) -> str:
    env = Environment(
        loader=FileSystemLoader(str(_TEMPLATES_DIR)),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("web_guide.html")
    return template.render(
        brand=brand,
        persona=persona,
        tokens=_palette_tokens(brand),
        downloads=downloads or {},
    )


async def build_web_guide(
    brand: BrandAssets,
    persona: Persona,
    job_id: str,
    downloads: Optional[dict[str, str]] = None,
) -> str:
    """Render the long-scroll web brand guide HTML and upload it."""
    html = render_web_guide_html(brand, persona, downloads)
    return await storage.upload_image(
        html.encode("utf-8"),
        "brand-guides",
        f"jobs/{job_id}/index.html",
        content_type="text/html",
    )
