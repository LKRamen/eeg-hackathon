"""End-to-end brand pipeline orchestrator.

Person 4's contribution to Person 1's pipeline. Wires:
  - brand.assemble   (Phase 2)         brand_assets generation
  - matching.match   (Person 2 stub)   agency matches
  - export.build_*   (Phases 2-4)      every downloadable artifact

Returns a populated BrandResult. Each export uses `return_exceptions=True`
in the parallel block so a single failed deck doesn't kill the brand
guide — only the brand guide PDF is required; everything else is optional
in the schema.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Optional

from apps.api.models.schemas import BrandResult, Persona

from . import brand as brand_service
from . import export
from ._matching_stub import match as match_agencies

logger = logging.getLogger(__name__)


def _as_url(value: object) -> Optional[str]:
    """Asyncio.gather with return_exceptions yields exceptions OR strings."""
    return value if isinstance(value, str) else None


async def run_pipeline(
    persona: Persona, product_idea: str, job_id: str
) -> BrandResult:
    """Run the full Halo pipeline end-to-end for one job."""
    brand_assets = await brand_service.assemble(persona, product_idea, job_id)
    agency_matches = await match_agencies(persona)
    top_match = agency_matches[0] if agency_matches else None

    guide_t = export.build_brand_guide(brand_assets, persona, job_id)
    deck_t = (
        export.build_pitch_deck(brand_assets, persona, top_match, job_id)
        if top_match
        else None
    )
    mfg_t = export.build_mfg_spec(brand_assets, job_id)

    parallel_tasks = [t for t in (guide_t, deck_t, mfg_t) if t is not None]
    parallel_results = await asyncio.gather(*parallel_tasks, return_exceptions=True)

    # Distribute results back to named slots in the original order.
    result_iter = iter(parallel_results)
    guide_url = _as_url(next(result_iter))
    deck_url = _as_url(next(result_iter)) if deck_t else None
    mfg_url = _as_url(next(result_iter)) if mfg_t else None

    # Web guide takes the PDF URLs as download links.
    web_url_or_exc = await asyncio.gather(
        export.build_web_guide(
            brand_assets,
            persona,
            job_id,
            downloads={
                "brand_guide_pdf_url": guide_url or "",
                "pitch_deck_pdf_url": deck_url or "",
            },
        ),
        return_exceptions=True,
    )
    web_url = _as_url(web_url_or_exc[0])

    zip_url_or_exc = await asyncio.gather(
        export.build_brand_kit_zip(
            brand_assets,
            persona,
            guide_url,
            deck_url,
            mfg_url,
            job_id=job_id,
        ),
        return_exceptions=True,
    )
    zip_url = _as_url(zip_url_or_exc[0])

    if guide_url is None:
        logger.error("brand guide failed for job_id=%s", job_id)

    return BrandResult(
        persona=persona,
        brand_assets=brand_assets,
        agency_matches=agency_matches,
        # Main's BrandResult requires brand_guide_pdf_url: str — always coerce.
        brand_guide_pdf_url=guide_url or "",
        pitch_deck_pdf_url=deck_url,
        web_guide_url=web_url,
        mfg_spec_sheet_pdf_url=mfg_url,
        brand_kit_zip_url=zip_url,
    )
