from __future__ import annotations

import datetime as dt
import logging
from typing import Optional

from apps.api.models.schemas import AgencyMatch, BrandAssets, Persona

from . import _storage as storage
from ._template_helpers import jinja_env, palette_tokens, render_pdf

logger = logging.getLogger(__name__)


def render_pitch_deck_html(
    brand: BrandAssets, persona: Persona, agency_match: Optional[AgencyMatch] = None
) -> str:
    template = jinja_env().get_template("pitch_deck.html")
    return template.render(
        brand=brand,
        persona=persona,
        agency_match=agency_match,
        tokens=palette_tokens(brand),
        date=dt.date.today().isoformat(),
    )


async def build_pitch_deck(
    brand: BrandAssets,
    persona: Persona,
    agency_match: Optional[AgencyMatch],
    job_id: str,
) -> str:
    """Render the 5-slide landscape pitch deck PDF (HTML fallback when no GTK)."""
    html = render_pitch_deck_html(brand, persona, agency_match)
    pdf = render_pdf(html)

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
