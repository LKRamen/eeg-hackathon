from __future__ import annotations

import logging
from typing import Optional

from apps.api.models.schemas import BrandAssets, Persona

from . import _storage as storage
from ._template_helpers import jinja_env, palette_tokens

logger = logging.getLogger(__name__)


def render_web_guide_html(
    brand: BrandAssets,
    persona: Persona,
    downloads: Optional[dict[str, str]] = None,
) -> str:
    template = jinja_env().get_template("web_guide.html")
    return template.render(
        brand=brand,
        persona=persona,
        tokens=palette_tokens(brand),
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
