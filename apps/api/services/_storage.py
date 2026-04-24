from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from apps.api.config import get_settings

logger = logging.getLogger(__name__)

_CACHE_ROOT = Path(__file__).resolve().parent.parent / "cache"


def _local_url(path: Path) -> str:
    return path.resolve().as_uri()


async def upload_image(
    data: bytes,
    bucket: str,
    object_path: str,
    content_type: str = "image/png",
) -> str:
    """Upload bytes to the given storage backend.

    With Supabase configured (SUPABASE_URL + SUPABASE_SERVICE_KEY), uploads
    to the named bucket. Without it, falls back to local cache and returns
    a `file://` URL — keeps the scaffold bootable for hackathon demos.
    """
    settings = get_settings()
    if settings.supabase_url and settings.supabase_service_key:
        return await _upload_supabase(
            data, bucket, object_path, content_type, settings
        )

    target = _CACHE_ROOT / bucket / object_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    logger.info("upload_image: wrote %d bytes to %s", len(data), target)
    return _local_url(target)


async def _upload_supabase(
    data: bytes,
    bucket: str,
    object_path: str,
    content_type: str,
    settings,
) -> str:
    try:
        from supabase import create_client
    except ImportError as exc:
        raise RuntimeError("supabase package not installed") from exc

    client = create_client(settings.supabase_url, settings.supabase_service_key)
    storage = client.storage.from_(bucket)
    storage.upload(
        path=object_path,
        file=data,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return storage.get_public_url(object_path)
