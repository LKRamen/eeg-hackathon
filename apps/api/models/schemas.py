from pydantic import BaseModel, Field
from typing import Literal, Optional
from datetime import datetime


Platform = Literal["instagram", "tiktok", "youtube", "x"]


class CreateJobRequest(BaseModel):
    handle: str
    product_idea: str
    platform: Platform = "instagram"


class RawAudiencePost(BaseModel):
    """Single audience post — defaults so partial parses don't crash."""
    caption: str = ""
    hashtags: list[str] = Field(default_factory=list)
    like_count: int = 0
    comment_count: int = 0
    posted_at: Optional[datetime] = None
    image_url: Optional[str] = None


# Back-compat alias for code that imports Post.
Post = RawAudiencePost


class NetworkProfile(BaseModel):
    """A follower/following sample entry."""
    username: str
    bio: str = ""
    follower_count: int = 0


class NetworkInsights(BaseModel):
    """Person 2's network synthesis output — derived from followers/following."""
    audience_archetypes: list[str]
    common_interests: list[str]
    content_pillars: list[str]
    push_targets: list[str]
    brand_voice_match: str
    network_summary: str


class RawAudience(BaseModel):
    bio: str = ""
    follower_count: int = 0
    posts: list[RawAudiencePost] = Field(default_factory=list)
    top_hashtags: list[str] = Field(default_factory=list)
    top_mentioned_accounts: list[str] = Field(default_factory=list)
    followers_sample: list[NetworkProfile] = Field(default_factory=list)
    following_sample: list[NetworkProfile] = Field(default_factory=list)


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


# Person 3's strict mockup labels — drives template selection in canva.py.
MockupLabel = Literal["tee", "tote", "hat", "sticker"]


class Mockup(BaseModel):
    label: MockupLabel
    url: str


class LogoVariants(BaseModel):
    """Person 3's logo set — primary, mono, on-brand, avatar."""
    primary: str
    mono_dark: str
    mono_light: str
    on_brand: str
    # Default empty so Person 4's stub/orchestrator can compose without
    # an avatar render available — Person 3's real images.py always sets it.
    avatar: str = ""


class SocialAsset(BaseModel):
    """Single social-media-sized image, owned by Person 3's images module."""
    label: str
    url: str
    format: Literal["ig_square", "ig_story"]


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
