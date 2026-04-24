export type JobStatus =
  | "queued"
  | "scraping"
  | "synthesizing"
  | "generating"
  | "matching"
  | "generating_pdf"
  | "done"
  | "error";

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

export interface PaletteColor {
  hex: string;
  role: "primary" | "secondary" | "accent" | "bg" | "fg";
  name: string;
}

export interface TypographyFace {
  family: string;
  google_url: string;
}

export interface Typography {
  display: TypographyFace;
  body: TypographyFace;
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
  logo_url: string;
  palette: PaletteColor[];
  typography: Typography;
  voice: Voice;
  mockups: Mockup[];
}

export interface AgencyMatch {
  id: string;
  name: string;
  blurb: string;
  specialty_tags: string[];
  aesthetic_tags: string[];
  notable_clients: string[];
  min_budget: string;
  website: string;
  match_score: number;
  why: string;
}

export interface BrandResult {
  persona: Persona;
  brand_assets: BrandAssets;
  agency_matches: AgencyMatch[];
  brand_guide_pdf_url: string | null;
  error_message?: string;
}

export interface Job {
  id: string;
  handle: string;
  product_idea: string;
  platform: "instagram" | "tiktok" | "youtube";
  status: JobStatus;
  created_at: string;
  result: BrandResult | null;
}

export interface CreateJobRequest {
  handle: string;
  product_idea: string;
  platform: "instagram" | "tiktok" | "youtube";
}

export interface CreateJobResponse {
  job_id: string;
}
