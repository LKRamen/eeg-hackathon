export interface CreateJobRequest {
  handle: string;
  product_idea: string;
  platform: "instagram";
}

export interface Post {
  caption: string;
  hashtags: string[];
  like_count: number;
  comment_count: number;
  posted_at: string;
  image_url?: string | null;
}

export interface RawAudience {
  bio: string;
  follower_count: number;
  posts: Post[];
  top_hashtags: string[];
  top_mentioned_accounts: string[];
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
}

export interface Color {
  hex: string;
  role: "primary" | "secondary" | "accent" | "bg" | "fg";
  name: string;
}

export interface FontSpec {
  family: string;
  google_url: string;
}

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

export interface Mockup {
  label: string;
  url: string;
}

export interface BrandAssets {
  brand_name: string;
  tagline: string;
  logo_url: string;
  palette: Color[];
  typography: Typography;
  voice: Voice;
  mockups: Mockup[];
}

export interface BrandResult {
  persona: Persona;
  brand_assets: BrandAssets;
  agency_matches: AgencyMatch[];
  brand_guide_pdf_url: string;
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
