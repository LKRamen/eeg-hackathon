from __future__ import annotations

"""Canva Connect API client (client-credentials OAuth, no user login required).

Workflow for social posts:
  1. Upload the brand logo as a Canva asset.
  2. Call autofill on a pre-created brand template (CANVA_SOCIAL_TEMPLATE_IDS).
  3. Poll until the autofill job completes — it returns a new design ID.
  4. Export that design as PNG and return the URL.

If no template IDs are configured, the caller falls back to Pillow composition.
"""

import asyncio
import base64
import time
from dataclasses import dataclass, field
from typing import Any

import httpx

from config import get_settings

_BASE = "https://api.canva.com/rest/v1"
_TOKEN_URL = f"{_BASE}/oauth/token"


@dataclass
class _TokenCache:
    access_token: str = ""
    expires_at: float = 0.0


_cache: _TokenCache = field(default_factory=_TokenCache)  # type: ignore[assignment]
_cache = _TokenCache()


async def _get_token() -> str:
    """Return a valid OAuth token, refreshing if expired."""
    s = get_settings()
    if not s.canva_client_id or not s.canva_client_secret:
        raise RuntimeError("CANVA_CLIENT_ID / CANVA_CLIENT_SECRET not set")

    if time.time() < _cache.expires_at - 60:
        return _cache.access_token

    credentials = base64.b64encode(
        f"{s.canva_client_id}:{s.canva_client_secret}".encode()
    ).decode()

    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.post(
            _TOKEN_URL,
            headers={"Authorization": f"Basic {credentials}"},
            data={
                "grant_type": "client_credentials",
                "scope": "design:content:write asset:write asset:read",
            },
        )
        resp.raise_for_status()
        body = resp.json()

    _cache.access_token = body["access_token"]
    _cache.expires_at = time.time() + body.get("expires_in", 3600)
    return _cache.access_token


async def _headers() -> dict[str, str]:
    token = await _get_token()
    return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


# ---------------------------------------------------------------------------
# Asset upload
# ---------------------------------------------------------------------------


async def upload_asset(image_bytes: bytes, name: str) -> str:
    """Upload a PNG to Canva and return the asset ID."""
    token = await _get_token()
    metadata_b64 = base64.b64encode(f'{{"name_base64":"{base64.b64encode(name.encode()).decode()}"}}'.encode()).decode()

    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"{_BASE}/assets",
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
                "Asset-Upload-Metadata": base64.b64encode(
                    f'{{"name_base64":"{base64.b64encode(name.encode()).decode()}"}}'.encode()
                ).decode(),
            },
            content=image_bytes,
        )
        resp.raise_for_status()
        return resp.json()["asset"]["id"]


# ---------------------------------------------------------------------------
# Design autofill
# ---------------------------------------------------------------------------

AutofillData = list[dict[str, Any]]


async def autofill_template(
    template_id: str,
    data: AutofillData,
    title: str = "Halo Brand Asset",
) -> str:
    """Run autofill on a Canva brand template, return the resulting design ID.

    `data` is a list of field dicts, e.g.:
      [{"name": "headline", "type": "text", "text": {"text": "Hello"}},
       {"name": "logo", "type": "image", "image": {"asset_id": "abc123"}}]
    """
    hdrs = await _headers()
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"{_BASE}/brand-templates/{template_id}/autofill",
            headers=hdrs,
            json={"title": title, "data": data},
        )
        resp.raise_for_status()
        job = resp.json()["job"]
        job_id: str = job["id"]

    return await _poll_autofill(template_id, job_id)


async def _poll_autofill(template_id: str, job_id: str, timeout: int = 60) -> str:
    """Poll autofill job until done, return design ID."""
    hdrs = await _headers()
    deadline = time.time() + timeout
    async with httpx.AsyncClient(timeout=15) as http:
        while time.time() < deadline:
            resp = await http.get(
                f"{_BASE}/brand-templates/{template_id}/autofill/{job_id}",
                headers=hdrs,
            )
            resp.raise_for_status()
            job = resp.json()["job"]
            if job["status"] == "success":
                return job["result"]["design"]["id"]
            if job["status"] == "failed":
                raise RuntimeError(f"Canva autofill failed: {job}")
            await asyncio.sleep(2)
    raise TimeoutError("Canva autofill timed out")


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


async def export_design_png(design_id: str, timeout: int = 120) -> str:
    """Export a Canva design as PNG, return the download URL."""
    hdrs = await _headers()
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"{_BASE}/exports",
            headers=hdrs,
            json={
                "design_id": design_id,
                "format": {"type": "png", "export_quality": "pro"},
            },
        )
        resp.raise_for_status()
        export_id: str = resp.json()["job"]["id"]

    return await _poll_export(export_id, timeout=timeout)


async def _poll_export(export_id: str, timeout: int = 120) -> str:
    hdrs = await _headers()
    deadline = time.time() + timeout
    async with httpx.AsyncClient(timeout=15) as http:
        while time.time() < deadline:
            resp = await http.get(f"{_BASE}/exports/{export_id}", headers=hdrs)
            resp.raise_for_status()
            job = resp.json()["job"]
            if job["status"] == "success":
                return job["urls"][0]
            if job["status"] == "failed":
                raise RuntimeError(f"Canva export failed: {job}")
            await asyncio.sleep(2)
    raise TimeoutError("Canva export timed out")


# ---------------------------------------------------------------------------
# Design creation
# ---------------------------------------------------------------------------

# Canva preset names → (label, edit_url_suffix)
_PRESETS = {
    "ig_square":    "InstagramPost",
    "ig_story":     "InstagramStory",
    "presentation": "Presentation",
    "linkedin":     "LinkedInPost",
    "email_header": "EmailHeader",
    "twitter":      "TwitterPost",
}


async def create_design(preset: str, title: str) -> dict[str, str]:
    """Create a blank Canva design. Returns {"id": ..., "edit_url": ..., "view_url": ...}"""
    hdrs = await _headers()
    canva_preset = _PRESETS.get(preset, "InstagramPost")
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            f"{_BASE}/designs",
            headers=hdrs,
            json={
                "design_type": {"type": "preset", "name": canva_preset},
                "title": title,
            },
        )
        resp.raise_for_status()
        design = resp.json()["design"]

    design_id = design["id"]
    urls = design.get("urls", {})
    return {
        "id": design_id,
        "edit_url": urls.get("edit_url", f"https://www.canva.com/design/{design_id}/edit"),
        "view_url": urls.get("view_url", f"https://www.canva.com/design/{design_id}/view"),
    }


# ---------------------------------------------------------------------------
# Asset folders
# ---------------------------------------------------------------------------


async def create_asset_folder(name: str) -> str:
    """Create a named asset folder in Canva, return the folder ID."""
    hdrs = await _headers()
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            f"{_BASE}/asset-folders",
            headers=hdrs,
            json={"name": name},
        )
        resp.raise_for_status()
        return resp.json()["folder"]["id"]


async def add_asset_to_folder(asset_id: str, folder_id: str) -> None:
    """Move an uploaded asset into a folder."""
    hdrs = await _headers()
    async with httpx.AsyncClient(timeout=20) as http:
        resp = await http.post(
            f"{_BASE}/asset-folders/{folder_id}/assets",
            headers=hdrs,
            json={"asset_id": asset_id},
        )
        resp.raise_for_status()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def is_configured() -> bool:
    """True if Canva credentials are set."""
    s = get_settings()
    return bool(s.canva_client_id and s.canva_client_secret)


def social_template_ids() -> list[str]:
    s = get_settings()
    return [t.strip() for t in s.canva_social_template_ids.split(",") if t.strip()]


def mockup_template_ids() -> list[str]:
    s = get_settings()
    return [t.strip() for t in s.canva_mockup_template_ids.split(",") if t.strip()]
