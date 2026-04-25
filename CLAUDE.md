# Halo — Prompt-to-Brand Engine

Turn a creator's social handle + product idea into a complete brand identity: logo, style guide, mockups, social kit, and agency matches. Built for a 24–36 hr hackathon.

## Architecture

```
Next.js 14 (Vercel / Railway)
  ├─→ app/api/export/route.ts    PDFKit + Sharp + Puppeteer (brand guide PDF, 300dpi PNGs)
  └─→ components/MockupCanvas    Konva.js in-browser mockup preview + 300dpi PNG export

FastAPI (Render / Railway)  →  Supabase (Postgres + Storage)
  ├─→ Apify                      Instagram profile scraper
  ├─→ OpenAI GPT-4o              persona synthesis, brand copy, clustering (zero-shot)
  ├─→ OpenAI embeddings          audience interest clustering (embedding similarity mode)
  ├─→ Stable Diffusion (SDXL)    logo generation + lifestyle mockup images via Replicate
  └─→ Canva Connect API          social post templates, mockup autofill
```

Frontend polls `GET /jobs/{id}` every 2 s — no WebSockets.

## Repo layout

```
apps/
  web/           Next.js 14, App Router, Tailwind, shadcn/ui
  api/           FastAPI + uvicorn
    config.py        Settings (pydantic-settings, reads .env)
    main.py          CORS, /health, router wiring
    models/
      schemas.py     All Pydantic types — single source of truth
    routers/
      jobs.py        POST /jobs, GET /jobs/{id}
    services/
      storage.py     Supabase storage helpers (upload_image, upload_url, upload_pil)
      scraper.py     Apify Instagram scraper (Task 4)
      persona.py     GPT-4o persona synthesis (Task 5)
      canva.py       Canva Connect API client
      images.py      Visual generation — logos (Replicate), variants (Pillow), social (Canva)
      brand.py       Palette, fonts, voice, brand name, assembly orchestrator (Task 7)
      matching.py    Cosine similarity agency matching (Task 8)
      export.py      WeasyPrint PDF brand guide (Task 9)
      pipeline.py    Async pipeline orchestrator (Task 3)
    fixtures/
      sample_audience.json   Dev fallback when Apify is unavailable
      agencies.json          Seeded agency data for matching
    cache/                   Demo cache (populated by Task 11)
    _dev/
      test_visuals.py        Inner loop for logo/mockup iteration
      quality_grid.py        Multi-persona quality comparison grid
assets/
  fonts/                     Bundled TTFs (Inter, Space Grotesk, DM Sans, Fraunces, JetBrains Mono)
packages/
  types/index.ts             TypeScript mirrors of Pydantic models
```

## Running locally

```bash
# API
cd apps/api
pip install -r requirements.txt
# Edit apps/api/.env and fill in any keys you have (file already exists, gitignored).
uvicorn main:app --reload    # http://localhost:8000

# Web
cd apps/web
pnpm install
pnpm dev                     # http://localhost:3000
```

## Environment variables

| Variable | Purpose |
|---|---|
| `OPENAI_API_KEY` | Persona synthesis, palette, voice, brand names, embeddings |
| `REPLICATE_API_TOKEN` | FLUX schnell — logo + lifestyle image generation |
| `CANVA_CLIENT_ID` | Canva Connect API OAuth client ID |
| `CANVA_CLIENT_SECRET` | Canva Connect API OAuth client secret |
| `CANVA_SOCIAL_TEMPLATE_IDS` | Comma-separated Canva brand template IDs for social posts |
| `CANVA_MOCKUP_TEMPLATE_IDS` | Comma-separated Canva brand template IDs for mockups |
| `APIFY_TOKEN` | Instagram profile scraper |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (bypasses RLS) |
| `CACHE_MODE` | `true` → serve cached result for DEMO_HANDLE |
| `DEMO_HANDLE` | Instagram handle to serve from cache |

## Key contracts (Person 3 ↔ Person 4)

Person 3 (`services/images.py`) exposes three async functions. Person 4 (`services/brand.py`) calls them in parallel after generating `palette` and `brand_name`.

```python
# Person 3 produces
async def generate_logo_set(brand_name, product_idea, persona, brand_color_hex, job_id) -> LogoVariants
async def generate_mockups(brand_name, persona, job_id, include=["tee","tote"]) -> list[Mockup]
async def generate_social_kit(brand_name, tagline, persona, logo_url, brand_color_hex, job_id) -> list[SocialAsset]

# Person 4 calls them like this (pseudocode in brand.assemble())
logo_set, mockups, social = await asyncio.gather(
    images.generate_logo_set(brand_name, product_idea, persona, palette[0].hex, job_id),
    images.generate_mockups(brand_name, persona, job_id),
    images.generate_social_kit(brand_name, voice.examples[0], persona, logo_url, palette[0].hex, job_id),
)
```

Person 4 must generate `palette` (and thus `brand_color_hex`) BEFORE calling Person 3's logo set.

## Canva API overview

The Canva Connect API uses **client credentials OAuth** — no user login required for server-side generation.

- Token endpoint: `POST https://api.canva.com/rest/v1/oauth/token`
- Auth header: `Basic base64(CLIENT_ID:CLIENT_SECRET)`
- Tokens expire after 1 hour; `CanvaClient` refreshes automatically.
- Social post autofill requires brand templates pre-created in Canva with named data fields. Template IDs are stored in `CANVA_SOCIAL_TEMPLATE_IDS`. If unset, Pillow composition is used as fallback.

## Supabase storage buckets

| Bucket | Contents |
|---|---|
| `brand-assets` | Logos, mockups, social posts (all images) |
| `brand-guides` | PDF exports |

Paths follow `jobs/{job_id}/{filename}`.

## Image generation strategy

| Asset | Tool | Notes |
|---|---|---|
| Logo primary | Stable Diffusion SDXL (Replicate) | ~8 s, configurable via `SD_MODEL` |
| Logo variants (mono/avatar) | Pillow image processing | Derived from primary — consistent, free |
| Mockups (tee, tote) | Canva autofill → export (or SD fallback) | Canva gives better photo-realism |
| Social posts (lifestyle) | SD SDXL or Canva autofill | Atmospheric 1:1 or 9:16 |
| Social posts (hero, quote) | Pillow composition | Logo + brand color + tagline — reliable text |
| In-browser preview | Konva.js (`MockupCanvas`) | Drag, resize, transform; exports 300dpi PNG |
| Brand guide PDF | Puppeteer → A4, 300dpi | Via `POST /api/export` route in Next.js |
| Logo print-ready | Sharp → 2480px, 300dpi metadata | Via `POST /api/export` with `type: logo-print` |

## SD model options

Set `SD_MODEL` in `.env`:

| Value | Model | Speed | Quality | Cost |
|---|---|---|---|---|
| `sdxl` | stability-ai/sdxl | ~8 s | High | $0.012/img |
| `sd35-medium` | stable-diffusion-3.5-medium | ~5 s | High | $0.035/img |
| `sd35-large` | stable-diffusion-3.5-large | ~15 s | Best | $0.065/img |
| `flux-schnell` | black-forest-labs/flux-schnell | ~3 s | Good | $0.003/img |

## Export API (Node.js)

`POST /api/export` accepts JSON:

```json
{ "type": "brand-guide", "result": { ...BrandResult } }
{ "type": "logo-print",  "result": { ...BrandResult } }
```

- `brand-guide` — Full A4 PDF rendered by Puppeteer at 300dpi. Includes cover, persona, palette, voice, mockups.
- `logo-print` — Manufacturing-ready logo PNG at 2480px / 300dpi via Sharp.

Puppeteer requires Chrome; works out of the box on Railway/Render with `puppeteer` installed. On Vercel, swap for `puppeteer-core` + `@sparticuz/chromium-min`.

## Interest clustering

`services/clustering.py` provides `cluster_interests(interests, hashtags)`. Two modes:
- **Zero-shot GPT-4o** (default): sends interest signals to GPT-4o, gets scored cluster dict back.
- **Embedding similarity** (`use_embeddings=True`): embeds the audience query vs. 14 predefined cluster descriptions using `text-embedding-3-small`, then cosine-ranks.

Automatically falls back to the other mode if one fails.

## Development inner loop

```bash
cd apps/api
python _dev/test_visuals.py   # generates all assets for hardcoded test persona
python _dev/quality_grid.py   # 6-logo comparison + mockup grid → /tmp/grid.html
```

No running API or Supabase required for `test_visuals.py` — images are saved locally and Supabase upload is skipped when `SUPABASE_URL` is unset.

## Demo insurance

Task 11 pre-runs the full pipeline for the demo creator and saves results to `apps/api/cache/{handle}.json`. With `CACHE_MODE=true`, `POST /jobs` for that handle returns the cached result in <2 s with simulated stage delays so the UI animation plays normally.

Always have the backup demo video recorded before the presentation.
