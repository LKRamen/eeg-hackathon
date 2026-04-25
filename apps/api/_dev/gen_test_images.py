"""Standalone image generation test.

Loads fixtures/test_brand_result.json and runs the full image generation
pipeline against it. Saves all outputs locally to /tmp/halo_gen/ so you
can inspect them without needing Supabase configured.

Usage (from apps/api/):
    python _dev/gen_test_images.py

Flags:
    --logo-only      Skip mockups and social kit (fastest, ~8s)
    --no-upload      Skip Supabase upload, save to /tmp/halo_gen/ instead
    --model sdxl     Override SD_MODEL for this run only

Examples:
    python _dev/gen_test_images.py --logo-only
    python _dev/gen_test_images.py --model sd35-medium
    python _dev/gen_test_images.py --no-upload
"""

from __future__ import annotations

import argparse
import asyncio
import io
import json
import os
import sys
import time
from pathlib import Path

# Put apps/api on the path so imports resolve when running directly
sys.path.insert(0, str(Path(__file__).parent.parent))

# ---------------------------------------------------------------------------
# Parse args before loading anything that reads settings
# ---------------------------------------------------------------------------

parser = argparse.ArgumentParser()
parser.add_argument("--logo-only", action="store_true")
parser.add_argument("--no-upload", action="store_true")
parser.add_argument("--model", default=None)
args = parser.parse_args()

if args.model:
    os.environ["SD_MODEL"] = args.model

# ---------------------------------------------------------------------------
# Patch storage to save locally when --no-upload is set
# ---------------------------------------------------------------------------

OUT_DIR = Path("/tmp/halo_gen")
OUT_DIR.mkdir(parents=True, exist_ok=True)


async def _local_save(image_bytes: bytes, path: str) -> str:
    """Save bytes locally and return a file:// URL."""
    dest = OUT_DIR / Path(path).name
    dest.write_bytes(image_bytes)
    print(f"    saved → {dest}")
    return f"file://{dest}"


if args.no_upload or not os.getenv("SUPABASE_URL"):
    import services.storage as _storage
    import httpx

    async def _patched_upload_image(image_bytes, bucket, path, content_type="image/png"):
        return await _local_save(image_bytes, path)

    async def _patched_upload_url(image_url, bucket, path):
        async with httpx.AsyncClient(timeout=30) as http:
            resp = await http.get(image_url)
            resp.raise_for_status()
        return await _local_save(resp.content, path)

    async def _patched_upload_pil(img, bucket, path, fmt="PNG"):
        import io as _io
        buf = _io.BytesIO()
        img.save(buf, format=fmt)
        return await _local_save(buf.getvalue(), path)

    _storage.upload_image = _patched_upload_image
    _storage.upload_url = _patched_upload_url
    _storage.upload_pil = _patched_upload_pil
    print("⚠  SUPABASE_URL not set — saving images to /tmp/halo_gen/ instead\n")

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

from models.schemas import BrandResult, Persona
from services.images import generate_logo_set, generate_mockups, generate_social_kit

FIXTURE = Path(__file__).parent.parent / "fixtures" / "test_brand_result.json"
TEST_JOB_ID = "test-gen-001"


def _load_fixture() -> BrandResult:
    raw = json.loads(FIXTURE.read_text())
    return BrandResult.model_validate(raw)


def _tick(label: str) -> float:
    print(f"\n{'─'*50}")
    print(f"▶  {label}")
    print(f"{'─'*50}")
    return time.time()


def _done(t0: float) -> None:
    print(f"   ✓ done in {time.time() - t0:.1f}s")


async def main() -> None:
    result = _load_fixture()
    persona: Persona = result.persona
    brand = result.brand_assets

    primary_hex = next(
        (c.hex for c in brand.palette if c.role == "primary"),
        "#0a0a0a",
    )
    tagline = brand.voice.examples[0] if brand.voice.examples else "Untitled"

    model_name = os.getenv("SD_MODEL", "sdxl")
    print(f"\n{'═'*50}")
    print(f"  Halo image generation test")
    print(f"  Brand:   {brand.brand_name}")
    print(f"  Persona: {persona.name} · {persona.age_range}")
    print(f"  Model:   {model_name}")
    print(f"  Job ID:  {TEST_JOB_ID}")
    print(f"{'═'*50}")

    # ------------------------------------------------------------------
    # Logo set
    # ------------------------------------------------------------------
    t = _tick("Logo set (primary via SD + 4 Pillow variants)")
    logos = await generate_logo_set(
        brand_name=brand.brand_name,
        product_idea="matcha energy drink for late-night creatives",
        persona=persona,
        brand_color_hex=primary_hex,
        job_id=TEST_JOB_ID,
    )
    _done(t)
    print(f"   primary:    {logos.primary}")
    print(f"   mono_dark:  {logos.mono_dark}")
    print(f"   mono_light: {logos.mono_light}")
    print(f"   on_brand:   {logos.on_brand}")
    print(f"   avatar:     {logos.avatar}")

    if args.logo_only:
        print("\n✓ --logo-only flag set, stopping here.")
        return

    # ------------------------------------------------------------------
    # Mockups (tee + tote in parallel)
    # ------------------------------------------------------------------
    t = _tick("Mockups: tee + tote (parallel SD calls)")
    mockups = await generate_mockups(
        brand_name=brand.brand_name,
        persona=persona,
        job_id=TEST_JOB_ID,
        include=["tee", "tote"],
    )
    _done(t)
    for m in mockups:
        print(f"   {m.label}: {m.url}")

    # ------------------------------------------------------------------
    # Social kit (5 assets: Pillow + SD, all parallel)
    # ------------------------------------------------------------------
    t = _tick("Social kit: 5 assets (hero, quote, lifestyle, story × 2)")
    social = await generate_social_kit(
        brand_name=brand.brand_name,
        tagline=tagline,
        persona=persona,
        logo_url=logos.mono_dark,
        brand_color_hex=primary_hex,
        job_id=TEST_JOB_ID,
    )
    _done(t)
    for s in social:
        print(f"   {s.label} ({s.format}): {s.url}")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print(f"\n{'═'*50}")
    print(f"  All done. {1 + len(mockups) + len(social)} images generated.")
    if args.no_upload or not os.getenv("SUPABASE_URL"):
        print(f"  Files saved to: {OUT_DIR}")
    print(f"{'═'*50}\n")


if __name__ == "__main__":
    asyncio.run(main())
