from __future__ import annotations

from fastapi import APIRouter, BackgroundTasks, HTTPException

from ..models.schemas import CreateJobRequest, Job
from ..services import jobs_db
from ..services.pipeline import run_pipeline

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.post("", status_code=202)
async def create_job(body: CreateJobRequest, background_tasks: BackgroundTasks):
    job_id = jobs_db.create_job(
        handle=body.handle,
        product_idea=body.product_idea,
        platform=body.platform,
        user_id="anon",
    )
    background_tasks.add_task(run_pipeline, job_id)
    return {"job_id": job_id}


@router.get("/{job_id}", response_model=Job)
async def get_job(job_id: str):
    try:
        return jobs_db.get_job(job_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found")
