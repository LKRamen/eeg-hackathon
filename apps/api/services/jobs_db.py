from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..db import get_supabase
from ..models.schemas import BrandResult, Job

_TABLE = "jobs"


def create_job(handle: str, product_idea: str, platform: str, user_id: str) -> str:
    job_id = str(uuid.uuid4())
    get_supabase().table(_TABLE).insert(
        {
            "id": job_id,
            "user_id": user_id,
            "handle": handle,
            "product_idea": product_idea,
            "platform": platform,
            "status": "queued",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
    ).execute()
    return job_id


def get_job(job_id: str) -> Job:
    resp = (
        get_supabase().table(_TABLE).select("*").eq("id", job_id).single().execute()
    )
    return Job.model_validate(resp.data)


def update_status(job_id: str, status: str) -> None:
    get_supabase().table(_TABLE).update({"status": status}).eq("id", job_id).execute()


def set_result(job_id: str, result: BrandResult) -> None:
    get_supabase().table(_TABLE).update(
        {"status": "done", "result": result.model_dump()}
    ).eq("id", job_id).execute()


def set_error(job_id: str, error_message: str) -> None:
    get_supabase().table(_TABLE).update(
        {"status": "error", "error_message": error_message}
    ).eq("id", job_id).execute()
