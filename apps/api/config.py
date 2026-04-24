from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration sourced from environment variables / .env.

    Missing provider keys are tolerated — services fall back to fixtures so the
    scaffold can boot without credentials. Live pipeline runs require them.
    """

    openai_api_key: str = Field(default="", alias="OPENAI_API_KEY")
    replicate_api_token: str = Field(default="", alias="REPLICATE_API_TOKEN")
    apify_token: str = Field(default="", alias="APIFY_TOKEN")
    supabase_url: str = Field(default="", alias="SUPABASE_URL")
    supabase_service_key: str = Field(default="", alias="SUPABASE_SERVICE_KEY")

    cache_mode: bool = Field(default=False, alias="CACHE_MODE")
    demo_handle: str = Field(default="", alias="DEMO_HANDLE")

    cors_origins: list[str] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
