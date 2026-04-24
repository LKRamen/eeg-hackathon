from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime


class CreateJobRequest(BaseModel):
    handle: str
    product_idea: str
    platform: Literal["instagram"] = "instagram"


class Post(BaseModel):
    caption: str
    hashtags: list[str]
    like_count: int
    comment_count: int
    posted_at: str
    image_url: Optional[str] = None


class RawAudience(BaseModel):
    bio: str
    follower_count: int
    posts: list[Post]
    top_hashtags: list[str]
    top_mentioned_accounts: list[str]


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


class AgencyMatch(BaseModel):
    agency_id: str
    name: str
    blurb: str
    specialty_tags: list[str]
    match_score: float
    why: str


class Color(BaseModel):
    hex: str
    role: Literal["primary", "secondary", "accent", "bg", "fg"]
    name: str


class FontSpec(BaseModel):
    family: str
    google_url: str


class Typography(BaseModel):
    display: FontSpec
    body: FontSpec


class Voice(BaseModel):
    tone: str
    do: list[str]
    dont: list[str]
    examples: list[str]


class Mockup(BaseModel):
    label: str
    url: str


class BrandAssets(BaseModel):
    brand_name: str
    tagline: str
    logo_url: str
    palette: list[Color]
    typography: Typography
    voice: Voice
    mockups: list[Mockup]


class BrandResult(BaseModel):
    persona: Persona
    brand_assets: BrandAssets
    agency_matches: list[AgencyMatch]
    brand_guide_pdf_url: str


class Job(BaseModel):
    id: str
    handle: str
    product_idea: str
    platform: str
    status: Literal[
        "queued", "scraping", "synthesizing",
        "generating", "matching", "exporting",
        "done", "error"
    ]
    created_at: datetime
    error_message: Optional[str] = None
    result: Optional[BrandResult] = None
