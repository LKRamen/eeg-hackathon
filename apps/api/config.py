from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# Pin the env file to an absolute path so it's found regardless of where
# uvicorn / pytest / a one-off script is launched from.
_ENV_FILE = Path(__file__).resolve().parent / ".env"


class Settings(BaseSettings):
    """Runtime configuration sourced from environment variables / .env.

    Missing provider keys are tolerated — services fall back to fixtures so the
    scaffold can boot without credentials. Live pipeline runs require them.
    """

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    hf_token: str = Field(default="", alias="HF_TOKEN")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_key: str = Field(default="", alias="SUPABASE_SERVICE_KEY")

    # HF model repo for image generation — default is FLUX.1-schnell (free, Apache 2.0)
    image_model: str = Field(default="black-forest-labs/FLUX.1-schnell", alias="IMAGE_MODEL")

    canva_client_id: str = Field(default="", alias="CANVA_CLIENT_ID")
    canva_client_secret: str = Field(default="", alias="CANVA_CLIENT_SECRET")
    # Comma-separated Canva brand template IDs — leave blank to use Pillow fallback
    canva_social_template_ids: str = Field(default="", alias="CANVA_SOCIAL_TEMPLATE_IDS")
    canva_mockup_template_ids: str = Field(default="", alias="CANVA_MOCKUP_TEMPLATE_IDS")

    cache_mode: bool = Field(default=False, alias="CACHE_MODE")
    demo_handle: str = Field(default="", alias="DEMO_HANDLE")

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
