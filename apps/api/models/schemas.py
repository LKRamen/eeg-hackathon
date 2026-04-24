from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

JobStatus = Literal[
    "queued",
    "scraping",
    "synthesizing",
    "generating",
    "matching",
    "generating_pdf",
    "done",
    "error",
]

Platform = Literal["instagram", "tiktok", "youtube"]
PaletteRole = Literal["primary", "secondary", "accent", "bg", "fg"]


class Persona(BaseModel):
    name: str
    age_range: str
    location_archetype: str
    psychographics: list[str]
    interests: list[str]
    purchase_signals: list[str]
    aesthetic_keywords: list[str]
    voice_traits: list[str]
    summary: str


class PaletteColor(BaseModel):
    hex: str
    role: PaletteRole
    name: str


class TypographyFace(BaseModel):
    family: str
    google_url: str


class Typography(BaseModel):
    display: TypographyFace
    body: TypographyFace


class Voice(BaseModel):
    tone: str
    do: list[str] = Field(default_factory=list)
    dont: list[str] = Field(default_factory=list)
    examples: list[str] = Field(default_factory=list)


class Mockup(BaseModel):
    label: str
    url: str


class BrandAssets(BaseModel):
    brand_name: str
    logo_url: str
    palette: list[PaletteColor]
    typography: Typography
    voice: Voice
    mockups: list[Mockup]


class AgencyMatch(BaseModel):
    id: str
    name: str
    blurb: str
    specialty_tags: list[str]
    aesthetic_tags: list[str]
    notable_clients: list[str]
    min_budget: str
    website: str
    match_score: float
    why: str


class BrandResult(BaseModel):
    persona: Persona
    brand_assets: BrandAssets
    agency_matches: list[AgencyMatch]
    brand_guide_pdf_url: Optional[str] = None
    error_message: Optional[str] = None


class CreateJobRequest(BaseModel):
    handle: str
    product_idea: str
    platform: Platform = "instagram"


class CreateJobResponse(BaseModel):
    job_id: str


class Job(BaseModel):
    id: str
    handle: str
    product_idea: str
    platform: Platform
    status: JobStatus
    created_at: datetime
    result: Optional[BrandResult] = None


class RawAudiencePost(BaseModel):
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    like_count: int = 0
    comment_count: int = 0
    posted_at: Optional[datetime] = None
    image_url: Optional[str] = None


class RawAudience(BaseModel):
    bio: str = ""
    follower_count: int = 0
    posts: list[RawAudiencePost] = Field(default_factory=list)
    top_hashtags: list[str] = Field(default_factory=list)
    top_mentioned_accounts: list[str] = Field(default_factory=list)
