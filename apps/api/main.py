from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .routers import health, jobs

settings = get_settings()

app = FastAPI(title="Halo API", version="0.0.1")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(jobs.router)

# Serve cached demo assets (logos, mockups, social PNGs) under /static/{handle}/...
_CACHE_DIR = Path(__file__).resolve().parent / "cache"
if _CACHE_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(_CACHE_DIR)), name="static")
