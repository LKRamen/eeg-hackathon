from __future__ import annotations

import logging
import os

from ..models.schemas import BrandResult
from . import jobs_db
from ._stubs import export  # phase 3d: swap to Node /api/export

log = logging.getLogger(__name__)

USE_STUBS = os.getenv("USE_STUBS", "false").lower() == "true"

if USE_STUBS:
    from ._stubs import scraper as scraper_svc
    from ._stubs import persona_svc
    from ._stubs import matching as matching_svc
    from ._stubs import brand
    log.info("USE_STUBS=true — pipeline using all-stub services")
else:
    from . import scraper as scraper_svc
    from . import persona as persona_svc
    from . import matching as matching_svc
    from . import brand  # real assemble() — palette/typo/voice via Claude; images via HF + Pillow


async def _build_canva_kit(brand_assets, job_id: str) -> tuple[dict | None, str | None]:
    """Try to build a Canva GTM kit. Returns (edit_urls, folder_url) or (None, None)."""
    try:
        from . import canva as canva_svc
        if not canva_svc.is_configured():
            return None, None
        from .gtm_canva import build_gtm_kit
        kit = await build_gtm_kit(brand_assets, job_id)
        return kit.edit_urls, kit.asset_folder_url
    except Exception as exc:
        log.warning("Canva kit skipped (%s)", exc)
        return None, None


async def run_pipeline(job_id: str) -> None:
    try:
        job = jobs_db.get_job(job_id)

        jobs_db.update_status(job_id, "scraping")
        audience = await scraper_svc.scrape(job.handle, job.platform)

        jobs_db.update_status(job_id, "synthesizing")
        persona = await persona_svc.synthesize(job.product_idea, audience)

        jobs_db.update_status(job_id, "generating")
        brand_assets = await brand.assemble(persona, job.product_idea, job_id)

        jobs_db.update_status(job_id, "matching")
        matches = await matching_svc.match(persona)

        jobs_db.update_status(job_id, "exporting")
        pdf_url = await export.build_pdf(brand_assets, persona)

        # Optional: build Canva GTM kit (skipped gracefully if no credentials)
        canva_edit_urls, canva_folder_url = await _build_canva_kit(brand_assets, job_id)

        result = BrandResult(
            persona=persona,
            brand_assets=brand_assets,
            agency_matches=matches,
            brand_guide_pdf_url=pdf_url,
            canva_edit_urls=canva_edit_urls,
            canva_folder_url=canva_folder_url,
        )
        jobs_db.set_result(job_id, result)
        log.info("pipeline done: %s", job_id)

    except Exception as exc:
        log.exception("pipeline error for %s", job_id)
        jobs_db.set_error(job_id, str(exc))
