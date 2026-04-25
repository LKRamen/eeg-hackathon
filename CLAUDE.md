# Halo — Prompt-to-Brand Engine

Turn a creator's social handle + product idea into a complete brand identity: logo, style guide, mockups, and social kit. Built for a 24–36 hr hackathon.

## Architecture

```
Next.js 14 (Vercel / Railway)
  ├─→ app/api/export/route.ts    PDFKit + Sharp + Puppeteer (brand guide PDF, 300dpi PNGs)
  └─→ components/MockupCanvas    Konva.js in-browser mockup preview + 300dpi PNG export

FastAPI (Render / Railway)  →  Supabase (Postgres + Storage)
  ├─→ Apify                      Instagram profile scraper
  ├─→ OpenAI GPT-4o              persona synthesis, brand copy, clustering (zero-shot)
  ├─→ OpenAI embeddings          audience interest clustering (embedding similarity mode)
  └─→ Stable Diffusion (SDXL)    logo generation + lifestyle mockup images via Replicate
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
      images.py      Visual generation — logos (Replicate), variants (Pillow), social (SD/Pillow)
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
| `CF_ACCOUNT_ID` | Cloudflare account ID — image generation via Workers AI |
| `CF_API_TOKEN` | Cloudflare API token — image generation via Workers AI |
| `REPLICATE_API_TOKEN` | Replicate API token — Stable Diffusion image generation |
| `APIFY_TOKEN` | Instagram profile scraper |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (bypasses RLS) |
| `CACHE_MODE` | `true` → serve cached result for DEMO_HANDLE |
| `DEMO_HANDLE` | Instagram handle to serve from cache |

> **Removed**: `CANVA_CLIENT_ID`, `CANVA_CLIENT_SECRET`, `CANVA_SOCIAL_TEMPLATE_IDS`, `CANVA_MOCKUP_TEMPLATE_IDS` — Canva integration has been fully dropped.

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

> **Note**: All mockup and social post generation is now done entirely via Stable Diffusion (Replicate) and Pillow composition. There is no Canva fallback — it has been removed.

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
| Mockups (tee, tote) | SD SDXL (Replicate) | Photo-realistic product mockups |
| Social posts (lifestyle) | SD SDXL | Atmospheric 1:1 or 9:16 |
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

## Frontend: Brand Assets section

The results page (`apps/web/app/results/[id]/page.tsx` or equivalent) renders a **Brand Assets** section above "Social Copy". This section is populated entirely from `job.result` — no separate API calls.

### Data sources

| UI Section | Data path |
|---|---|
| Logo Suite | `job.result.brand_assets.logo_variants` → `{ primary, mono_dark, mono_light, on_brand }` |
| Mockups | `job.result.brand_assets.mockups` → `[{ type: "tee" | "tote", url }]` |
| Social Kit | `job.result.brand_assets.social_assets` → `[{ format, url }]` |
| Brand palette | `job.result.brand_assets.palette` → `[{ hex, name }]` — drives all bg/accent colors |

### Layout spec

**Logo Suite** — horizontal row of 4 square tiles. `on_brand` is the hero (2×). Tile backgrounds:
- `mono_light` → dark background (`#111`)
- `mono_dark` → white background (`#fff`)
- `on_brand` → brand primary hex from palette
- `primary` → neutral light gray

**Mockups** — two large edge-to-edge cells (`tee`, `tote`). `object-fit: cover`, no padding compression.

**Social Kit** — bento grid of 5 assets. Story assets (9:16 ratio) render taller than post assets (1:1). Each cell: format badge (`IG Post` / `IG Story`) + download button. Download uses `fetch()` → blob → `<a download>` — not `window.open`.

### Debug logging (mount only)

```ts
console.log("brand_assets", job.result.brand_assets);
```

### Placeholder policy

If any field is `null` or missing, render a bordered placeholder with a short explanation (e.g. "Logo variants not yet generated"). Never render a broken empty section or throw.

### Typography

- Labels: `Space Grotesk`
- Format badges: `Space Mono`
- Generous whitespace between sections, fade-in on mount.

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