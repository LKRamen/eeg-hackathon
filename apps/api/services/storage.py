from __future__ import annotations

import io
import logging
from pathlib import Path
from typing import Literal

import httpx
from PIL import Image

from ..config import get_settings

logger = logging.getLogger(__name__)

Bucket = Literal["brand-assets", "brand-guides"]

# Local fallback directory when Supabase is not configured
_LOCAL_ROOT = Path(__file__).resolve().parent.parent / "cache"


def _supabase_configured() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)


def _supabase_client():
    from supabase import create_client
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def _local_save(data: bytes, bucket: str, path: str) -> str:
    """Save to cache/storage/<bucket>/<path> and return a public localhost URL."""
    target = _LOCAL_ROOT / bucket / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(data)
    logger.info("storage: saved locally → %s", target)
    # Return a path the frontend can't load directly, but good enough for API responses
    return f"http://localhost:8000/static/{bucket}/{path}"


async def upload_image(
    image_bytes: bytes,
    bucket: Bucket,
    path: str,
    content_type: str = "image/png",
) -> str:
    """Upload raw bytes. Uses Supabase if configured, else saves locally."""
    if _supabase_configured():
        try:
            sb = _supabase_client()
            sb.storage.from_(bucket).upload(
                path=path,
                file=image_bytes,
                file_options={"content-type": content_type, "upsert": "true"},
            )
            return sb.storage.from_(bucket).get_public_url(path)
        except Exception as exc:
            logger.warning("Supabase upload failed (%s), falling back to local", exc)

    return _local_save(image_bytes, bucket, path)


async def upload_url(image_url: str, bucket: Bucket, path: str) -> str:
    """Download from URL and rehost. Replicate URLs expire after ~1 hour."""
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(image_url)
        resp.raise_for_status()
    return await upload_image(resp.content, bucket, path)


async def upload_pil(
    img: Image.Image,
    bucket: Bucket,
    path: str,
    fmt: str = "PNG",
) -> str:
    """Encode a PIL image and upload."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return await upload_image(
        buf.getvalue(), bucket, path, content_type=f"image/{fmt.lower()}"
    )
