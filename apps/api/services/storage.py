from __future__ import annotations

import io
from typing import Literal

import httpx
from PIL import Image

from ..config import get_settings

Bucket = Literal["brand-assets", "brand-guides"]


def _client():
    # Lazy import — keeps supabase optional when storage is patched in tests
    from supabase import create_client  # noqa: PLC0415
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


async def upload_image(
    image_bytes: bytes,
    bucket: Bucket,
    path: str,
    content_type: str = "image/png",
) -> str:
    """Upload raw bytes to Supabase storage, return public URL."""
    sb = _client()
    sb.storage.from_(bucket).upload(
        path=path,
        file=image_bytes,
        file_options={"content-type": content_type, "upsert": "true"},
    )
    return sb.storage.from_(bucket).get_public_url(path)


async def upload_url(image_url: str, bucket: Bucket, path: str) -> str:
    """Download an image from a URL and rehost it in Supabase.

    Replicate output URLs expire after ~1 hour — always rehost before storing.
    """
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
    """Encode a PIL image and upload to Supabase."""
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return await upload_image(
        buf.getvalue(), bucket, path, content_type=f"image/{fmt.lower()}"
    )
