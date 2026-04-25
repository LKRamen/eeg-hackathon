from __future__ import annotations

import logging
import os

from ..models.schemas import BrandResult
from . import jobs_db
from ._stubs import brand, export  # always-stubbed today; swapped in Phase 3

log = logging.getLogger(__name__)

# USE_STUBS=true forces every service to its stub implementation. Useful as a
# demo-day fallback if any real provider (OpenAI / HF / Apify / Supabase) is
# flaky. Default false → keep the current swap state (real scraper / persona /
# matching, stub brand / export).
USE_STUBS = os.getenv("USE_STUBS", "false").lower() == "true"

if USE_STUBS:
    from ._stubs import scraper as scraper_svc
    from ._stubs import persona_svc
    from ._stubs import matching as matching_svc
    log.info("USE_STUBS=true — pipeline using all-stub services")
else:
    from . import scraper as scraper_svc
    from . import persona as persona_svc
    from . import matching as matching_svc


async def run_pipeline(job_id: str) -> None:
    try:
        job = jobs_db.get_job(job_id)

        jobs_db.update_status(job_id, "scraping")
        audience = await scraper_svc.scrape(job.handle, job.platform)

        jobs_db.update_status(job_id, "synthesizing")
        persona = await persona_svc.synthesize(job.product_idea, audience)

        jobs_db.update_status(job_id, "generating")
        brand_assets = await brand.assemble(persona, job.product_idea)

        jobs_db.update_status(job_id, "matching")
        matches = await matching_svc.match(persona)

        jobs_db.update_status(job_id, "exporting")
        pdf_url = await export.build_pdf(brand_assets, persona)

        result = BrandResult(
            persona=persona,
            brand_assets=brand_assets,
            agency_matches=matches,
            brand_guide_pdf_url=pdf_url,
        )
        jobs_db.set_result(job_id, result)
        log.info("pipeline done: %s", job_id)

    except Exception as exc:
        log.exception("pipeline error for %s", job_id)
        jobs_db.set_error(job_id, str(exc))
