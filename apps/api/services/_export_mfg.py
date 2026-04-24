from __future__ import annotations

import datetime as dt
import logging

from apps.api.models.schemas import BrandAssets

from . import _storage as storage
from ._template_helpers import jinja_env, render_pdf

logger = logging.getLogger(__name__)


# Tiny hand-curated Pantone subset. Real production color matching uses the
# full Solid Coated library (~2400 entries) — that data is licensed and
# can't be redistributed inline. This 10-entry subset gives a rough nearest
# match good enough for a visible "ballpark" in the mfg spec; the document
# footer states the limitation.
_PANTONE_SUBSET: tuple[tuple[str, str], ...] = (
    ("Black 6 C",     "#101820"),
    ("Cool Gray 11",  "#53565a"),
    ("Cool Gray 1",   "#d9d9d6"),
    ("White",         "#ffffff"),
    ("485 C",         "#da291c"),  # red
    ("172 C",         "#fa4616"),  # orange
    ("116 C",         "#ffcd00"),  # yellow
    ("355 C",         "#009639"),  # green
    ("286 C",         "#0033a0"),  # blue
    ("266 C",         "#5f259f"),  # purple
)


def hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def hex_to_cmyk(hex_color: str) -> tuple[int, int, int, int]:
    r, g, b = hex_to_rgb(hex_color)
    if r == 0 and g == 0 and b == 0:
        return (0, 0, 0, 100)
    rf, gf, bf = r / 255.0, g / 255.0, b / 255.0
    k = 1 - max(rf, gf, bf)
    c = (1 - rf - k) / (1 - k) if (1 - k) > 0 else 0
    m = (1 - gf - k) / (1 - k) if (1 - k) > 0 else 0
    y = (1 - bf - k) / (1 - k) if (1 - k) > 0 else 0
    return (round(c * 100), round(m * 100), round(y * 100), round(k * 100))


def closest_pantone(hex_color: str) -> str:
    target = hex_to_rgb(hex_color)
    best_name, best_dist = "", float("inf")
    for name, swatch_hex in _PANTONE_SUBSET:
        sr, sg, sb = hex_to_rgb(swatch_hex)
        dist = (sr - target[0]) ** 2 + (sg - target[1]) ** 2 + (sb - target[2]) ** 2
        if dist < best_dist:
            best_dist = dist
            best_name = name
    return best_name


def _format_rgb(rgb: tuple[int, int, int]) -> str:
    return f"R{rgb[0]} G{rgb[1]} B{rgb[2]}"


def _format_cmyk(cmyk: tuple[int, int, int, int]) -> str:
    return f"C{cmyk[0]} M{cmyk[1]} Y{cmyk[2]} K{cmyk[3]}"


def _build_color_rows(brand: BrandAssets) -> list[dict]:
    rows = []
    for c in brand.palette:
        rows.append({
            "hex": c.hex,
            "role": c.role,
            "name": c.name,
            "rgb": _format_rgb(hex_to_rgb(c.hex)),
            "cmyk": _format_cmyk(hex_to_cmyk(c.hex)),
            "pantone": closest_pantone(c.hex),
        })
    return rows


def render_mfg_spec_html(brand: BrandAssets) -> str:
    template = jinja_env().get_template("mfg_spec.html")
    return template.render(
        brand=brand,
        color_rows=_build_color_rows(brand),
        date=dt.date.today().isoformat(),
    )


async def build_mfg_spec(brand: BrandAssets, job_id: str) -> str:
    """Render the one-page manufacturing spec PDF (HTML fallback when no GTK)."""
    html = render_mfg_spec_html(brand)
    # mfg spec uses its own dense print CSS inline — no shared base.
    pdf = render_pdf(html, use_base_css=False)
    if pdf is not None:
        return await storage.upload_image(
            pdf,
            "brand-guides",
            f"jobs/{job_id}/mfg_spec.pdf",
            content_type="application/pdf",
        )
    return await storage.upload_image(
        html.encode("utf-8"),
        "brand-guides",
        f"jobs/{job_id}/mfg_spec.html",
        content_type="text/html",
    )
