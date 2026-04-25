from __future__ import annotations

import uuid
from datetime import datetime, timezone

from ..models.schemas import BrandResult, Job

_TABLE = "jobs"

# In-memory store — used when Supabase is not configured or creds are invalid
_mem: dict[str, dict] = {}
_supabase_ok: bool | None = None  # None = not yet probed


def _use_mem() -> bool:
    global _supabase_ok
    from ..config import get_settings
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        return True
    if _supabase_ok is False:
        return True
    if _supabase_ok is None:
        try:
            from ..db import get_supabase
            get_supabase()
            _supabase_ok = True
        except Exception:
            _supabase_ok = False
            return True
    return False


def _supabase():
    from ..db import get_supabase
    return get_supabase()


def create_job(handle: str, product_idea: str, platform: str, user_id: str) -> str:
    job_id = str(uuid.uuid4())
    row = {
        "id": job_id,
        "user_id": user_id,
        "handle": handle,
        "product_idea": product_idea,
        "platform": platform,
        "status": "queued",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "result": None,
    }
    if _use_mem():
        _mem[job_id] = row
    else:
        _supabase().table(_TABLE).insert(row).execute()
    return job_id


def get_job(job_id: str) -> Job:
    if _use_mem():
        if job_id not in _mem:
            raise KeyError(f"Job {job_id} not found")
        return Job.model_validate(_mem[job_id])
    resp = _supabase().table(_TABLE).select("*").eq("id", job_id).single().execute()
    return Job.model_validate(resp.data)


def update_status(job_id: str, status: str) -> None:
    if _use_mem():
        _mem[job_id]["status"] = status
    else:
        _supabase().table(_TABLE).update({"status": status}).eq("id", job_id).execute()


def set_result(job_id: str, result: BrandResult) -> None:
    if _use_mem():
        _mem[job_id]["status"] = "done"
        _mem[job_id]["result"] = result.model_dump()
    else:
        _supabase().table(_TABLE).update(
            {"status": "done", "result": result.model_dump()}
        ).eq("id", job_id).execute()


def set_error(job_id: str, error_message: str) -> None:
    if _use_mem():
        _mem[job_id]["status"] = "error"
        _mem[job_id]["error_message"] = error_message
    else:
        _supabase().table(_TABLE).update(
            {"status": "error", "error_message": error_message}
        ).eq("id", job_id).execute()
