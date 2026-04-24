from pydantic import BaseModel, Field
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
    # Additive fields used by Person 4's matching fixtures + pitch deck.
    aesthetic_tags: list[str] = Field(default_factory=list)
    notable_clients: list[str] = Field(default_factory=list)
    min_budget: str = ""
    website: str = ""


PaletteRole = Literal["primary", "secondary", "accent", "bg", "fg"]


class Color(BaseModel):
    hex: str
    role: PaletteRole
    name: str


# Alias so Person 4's services that import PaletteColor keep compiling.
PaletteColor = Color


class FontSpec(BaseModel):
    family: str
    google_url: str
    # Additive: weights used by mfg spec + brand guide font loading.
    weights: list[int] = Field(default_factory=lambda: [400, 700])


# Alias for Person 4's services that import TypographyFace.
TypographyFace = FontSpec


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


class LogoVariants(BaseModel):
    """Person 3's logo set — primary + monos + on-brand + avatar."""
    primary: str
    mono_dark: str
    mono_light: str
    on_brand: str
    avatar: str = ""


class SocialAsset(BaseModel):
    """Single social-media-sized image (post or story)."""
    label: str
    url: str
    platform: Literal["instagram", "tiktok", "youtube"] = "instagram"
    format: Literal["post", "story"] = "post"


class BrandAssets(BaseModel):
    brand_name: str
    tagline: str
    logo_url: str
    palette: list[Color]
    typography: Typography
    voice: Voice
    mockups: list[Mockup]
    # Additive fields (Person 4 — populated by the brand orchestrator).
    logo: Optional[LogoVariants] = None
    social_kit: list[SocialAsset] = Field(default_factory=list)


class BrandResult(BaseModel):
    persona: Persona
    brand_assets: BrandAssets
    agency_matches: list[AgencyMatch]
    brand_guide_pdf_url: str
    # Additive fields (Person 4 — every optional artifact).
    pitch_deck_pdf_url: Optional[str] = None
    web_guide_url: Optional[str] = None
    mfg_spec_sheet_pdf_url: Optional[str] = None
    brand_kit_zip_url: Optional[str] = None
    error_message: Optional[str] = None


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
