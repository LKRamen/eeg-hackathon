export type Platform = "instagram" | "tiktok" | "youtube" | "x";

export interface CreateJobRequest {
  handle: string;
  product_idea: string;
  platform: Platform;
}

// Pydantic: RawAudiencePost (alias `Post = RawAudiencePost` kept on the API).
export interface RawAudiencePost {
  caption: string;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  posted_at?: string | null;
  image_url?: string | null;
}

export type Post = RawAudiencePost;

export interface NetworkProfile {
  username: string;
  bio: string;
  follower_count: number;
}

export interface NetworkInsights {
  audience_archetypes: string[];
  common_interests: string[];
  content_pillars: string[];
  push_targets: string[];
  brand_voice_match: string;
  network_summary: string;
}

export interface RawAudience {
  bio: string;
  follower_count: number;
  posts: RawAudiencePost[];
  top_hashtags: string[];
  top_mentioned_accounts: string[];
  followers_sample: NetworkProfile[];
  following_sample: NetworkProfile[];
}

export interface Persona {
  name: string;
  age_range: string;
  location_archetype: string;
  psychographics: string[];
  interests: string[];
  purchase_signals: string[];
  aesthetic_keywords: string[];
  voice_traits: string[];
  summary: string;
}

export interface AgencyMatch {
  agency_id: string;
  name: string;
  blurb: string;
  specialty_tags: string[];
  match_score: number;
  why: string;
  // Additive fields populated by Person 4's matching fixtures.
  aesthetic_tags?: string[];
  notable_clients?: string[];
  min_budget?: string;
  website?: string;
}

export type PaletteRole = "primary" | "secondary" | "accent" | "bg" | "fg";

export interface Color {
  hex: string;
  role: PaletteRole;
  name: string;
}

// Alias: PaletteColor is what some Pydantic call sites use.
export type PaletteColor = Color;

export interface FontSpec {
  family: string;
  google_url: string;
  weights?: number[];
}

export type TypographyFace = FontSpec;

export interface Typography {
  display: FontSpec;
  body: FontSpec;
}

export interface Voice {
  tone: string;
  do: string[];
  dont: string[];
  examples: string[];
}

export type MockupLabel = "tee" | "tote" | "hat" | "sticker";

export interface Mockup {
  label: MockupLabel;
  url: string;
}

export interface LogoVariants {
  primary: string;
  mono_dark: string;
  mono_light: string;
  on_brand: string;
  avatar?: string;
}

export interface SocialAsset {
  label: string;
  url: string;
  format: "ig_square" | "ig_story";
}

export interface BrandAssets {
  brand_name: string;
  tagline: string;
  logo_url: string;
  palette: Color[];
  typography: Typography;
  voice: Voice;
  mockups: Mockup[];
  logo?: LogoVariants | null;
  social_kit?: SocialAsset[];
}

export interface BrandResult {
  persona: Persona;
  brand_assets: BrandAssets;
  agency_matches: AgencyMatch[];
  brand_guide_pdf_url: string;
  pitch_deck_pdf_url?: string | null;
  web_guide_url?: string | null;
  mfg_spec_sheet_pdf_url?: string | null;
  brand_kit_zip_url?: string | null;
  error_message?: string | null;
}

export type JobStatus =
  | "queued"
  | "scraping"
  | "synthesizing"
  | "generating"
  | "matching"
  | "exporting"
  | "done"
  | "error";

export interface Job {
  id: string;
  handle: string;
  product_idea: string;
  platform: string;
  status: JobStatus;
  created_at: string;
  error_message?: string | null;
  result?: BrandResult | null;
}
