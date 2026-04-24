# start.md — Prompt-to-Brand Engine

Hackathon build plan. Read the **Scope reality check** before writing any code.

---

## 0. Name options (pick one in the first 10 min, don't bikeshed)

- **Halo** — your brand's halo effect, generated from your audience
- **Mint** — "mint your brand"
- **Forge** — forge a brand from your following
- **Clout** — literal, memorable, slightly cheeky
- **Echo** — your audience echoed back as a brand
- **Persona** — does what it says
- **Brandcast** — broadcast + brand

Default to **Halo** below if you can't decide.

---

## 1. Scope reality check

The architecture in the spec is a 3-week build. In a 24–36hr window you need to ruthlessly cut. The judges care about the **wow moment** (handle in → brand out), not the marketplace plumbing.

### Build for real
- Single-page input form (handle + product idea)
- Scrape one platform (Instagram via Apify) — with a cached fallback for the demo
- GPT-4o persona synthesis
- 1 logo (Replicate FLUX or SDXL) + 2 mockups (tee + tote)
- Auto-generated style guide (colors + fonts + voice)
- 3 seeded "agency matches" with cosine similarity ranking
- PDF brand guide export
- Results page that streams in as things finish

### Fake / stub / cut
- ❌ Stripe Connect (button that says "Coming soon")
- ❌ Real manufacturer RFQ (button → "Request sent" toast)
- ❌ Auth (hard-code a single user, ship it)
- ❌ Celery + Redis (use FastAPI `BackgroundTasks` or just `asyncio`)
- ❌ Node.js backend (FastAPI handles everything; drop the dual-backend split)
- ❌ TikTok + YouTube scraping (one platform is enough)
- ❌ WebSockets (use polling every 2s — simpler, demo-safe)

### Demo insurance
**Pre-cache one creator's full pipeline result.** If Apify rate-limits or GPT-4o is slow during the demo, type the cached handle and serve from disk. The judges won't know.

---

## 2. Slimmed architecture

```
Next.js 14 (Vercel)  ──→  FastAPI (Render/Railway)  ──→  Supabase (Postgres + Storage)
                                  │
                                  ├─→ Apify (IG scraper actor)
                                  ├─→ OpenAI GPT-4o
                                  └─→ Replicate (FLUX.1 schnell — cheap + fast)
```

Polling, not WebSockets. Job status in Postgres, frontend hits `/jobs/{id}` every 2s.

---

## 3. Suggested team split (4 people)

| Person | Owns |
|---|---|
| A | Frontend (Tasks 1, 2, 10) |
| B | Backend scaffold + scraper (Tasks 3, 4) |
| C | AI pipeline (Tasks 5, 6, 7) |
| D | Matching + export + demo (Tasks 8, 9, 11) |

If you're 2 people: A does frontend + demo, B does backend + AI. Skip Tasks 8 and 9 for first pass.

---

## 4. Timeline (aim for this)

| Hour | Milestone |
|---|---|
| 0–2 | Setup, repo, env vars, Supabase schema, Apify + Replicate accounts |
| 2–8 | Tasks 1–6 in parallel; first end-to-end ugly version by hr 8 |
| 8–14 | Tasks 7–9, persona quality tuning, image prompt tuning |
| 14–18 | Tasks 10–11, polish, pre-cache the demo creator |
| 18–22 | Buffer for breakage, demo rehearsal, deploy |
| 22–24 | Sleep, food, rehearse pitch |

---

## 5. Subtask prompts

Each prompt below is designed to drop into Claude Code / Cursor. They assume the agent has filesystem + shell access. Run them in order within each track, but tracks can run in parallel after Task 0.

---

### Task 0 — Repo setup & shared types

```
Create a monorepo with this structure:

  halo/
    apps/
      web/          # Next.js 14 app router
      api/          # FastAPI
    packages/
      types/        # shared TypeScript types (mirror Pydantic models by hand)
    .env.example
    README.md

In apps/web: scaffold Next.js 14 with App Router, TypeScript, Tailwind, shadcn/ui
(init with `npx shadcn@latest init`, dark mode, slate base color).

In apps/api: scaffold FastAPI with:
  - uvicorn[standard], pydantic v2, httpx, python-dotenv, supabase-py,
    openai, replicate, apify-client
  - main.py with CORS allowing http://localhost:3000
  - /health endpoint returning {"ok": true}
  - routers/ folder, models/ folder, services/ folder

Create .env.example with: OPENAI_API_KEY, REPLICATE_API_TOKEN, APIFY_TOKEN,
SUPABASE_URL, SUPABASE_SERVICE_KEY, NEXT_PUBLIC_API_URL.

In packages/types/index.ts, define these shared types (Job, Persona, BrandAssets,
AgencyMatch). Match these to Pydantic models in apps/api/models/schemas.py.

Job has: id, handle, product_idea, status (queued|scraping|synthesizing|generating|done|error),
created_at, result (BrandResult | null).

BrandResult has: persona, brand_assets, agency_matches, brand_guide_pdf_url.

Output: working `pnpm dev` in web, working `uvicorn main:app --reload` in api.
```

---

### Task 1 — Input page (frontend)

```
In apps/web/app/page.tsx, build the landing + input page.

Hero: large headline "Turn your audience into a brand" with a subheadline.
Below the hero, a form with three fields:
  - Product idea (textarea, "What are you building? e.g. 'energy drink for late-night coders'")
  - Social handle (input with @ prefix, "@yourhandle")
  - Platform (select: Instagram only for now, but show TikTok/YouTube as "Coming soon")

Use shadcn Button, Input, Textarea, Card. Black background, single accent color
(use --primary, set it to a punchy lime or violet — pick one). Avoid generic
SaaS gradient slop. Lean editorial / magazine-cover energy.

On submit:
  - POST to ${NEXT_PUBLIC_API_URL}/jobs with { handle, product_idea, platform }
  - API returns { job_id }
  - router.push(`/jobs/${job_id}`)

Add a "Try a demo creator" button that auto-fills with a known cached handle
(we'll set this in Task 11).

No real auth. Just localStorage a uuid to identify the "user".
```

---

### Task 2 — Results / loading page (frontend)

```
Create apps/web/app/jobs/[id]/page.tsx.

This page polls GET /jobs/{id} every 2 seconds via SWR. Show stages with a
progress indicator:
  1. Scraping audience
  2. Building persona
  3. Generating brand assets
  4. Matching agencies

Each stage lights up as job.status advances. Use a vertical timeline UI.

When status === 'done', render the results in this order down the page:
  - Persona card (avatar emoji, name, age range, psychographics, top interests)
  - Brand assets: logo (large), color palette swatches, typography sample,
    voice/tone snippet
  - Mockups: 2 product images side by side (tee, tote)
  - Agency matches: 3 cards with name, specialty, match %
  - Footer CTAs: "Download brand guide PDF" (real), "Request manufacturing
    quote" (fake — toast "We've notified 3 manufacturers"),
    "Connect with agency" (fake — same pattern)

Stop polling once status is done or error. Show a friendly error state if error.

Make this page feel like a finished product reveal, not a dashboard. Big visuals,
generous whitespace.
```

---

### Task 3 — FastAPI job orchestrator

```
In apps/api, build the job lifecycle.

Supabase schema (write migrations.sql):
  jobs(id uuid pk, user_id text, handle text, product_idea text, platform text,
       status text, created_at timestamptz default now(), result jsonb)

Endpoints:
  POST /jobs
    body: { handle, product_idea, platform }
    creates row with status='queued', kicks off background pipeline, returns {job_id}

  GET /jobs/{id}
    returns full job row

Pipeline (services/pipeline.py) is a single async function run_pipeline(job_id):
  1. set status='scraping', call services.scraper.scrape(handle) -> RawAudience
  2. set status='synthesizing', call services.persona.synthesize(...) -> Persona
  3. set status='generating', concurrently call:
       - services.brand.generate_logo(...)
       - services.brand.generate_palette_and_fonts(...)
       - services.brand.generate_mockups(...)
       - services.brand.generate_voice(...)
  4. set status='matching', call services.matching.match(persona) -> [AgencyMatch]
  5. set status='generating_pdf', call services.export.build_pdf(...) -> url
  6. set status='done', write full result to jobs.result

Use FastAPI BackgroundTasks. No Celery, no Redis.

Wrap each stage in try/except; on failure set status='error' with error_message in result.

Add a CACHE_MODE env flag. When CACHE_MODE=true and handle matches our demo handle,
serve from /apps/api/cache/{handle}.json instead of running the pipeline. (Task 11
populates this.)
```

---

### Task 4 — Apify scraper module

```
Create apps/api/services/scraper.py.

Use apify-client to run the Instagram Profile Scraper actor (apify/instagram-profile-scraper).
Input: { usernames: [handle], resultsLimit: 30 }.

Wait for run to finish (poll every 2s, timeout 60s). Pull dataset items.

From the scraped data, extract and return RawAudience:
  - bio
  - follower_count
  - posts: list of { caption, hashtags, like_count, comment_count, posted_at, image_url }
    (limit to 20 most recent)
  - top_hashtags: aggregate top 15 by frequency
  - top_mentioned_accounts: top 10 mentions

Handle the rate limit / private profile / not-found cases by raising a
ScraperError with a user-friendly message.

If APIFY_TOKEN is missing OR scraping fails, fall back to a hardcoded fixture
in fixtures/sample_audience.json so dev never blocks. Log when fallback is used.

Cost note: this Apify actor is ~$2.30 per 1000 profiles. Fine for hackathon scale.
```

---

### Task 5 — Persona synthesis

```
Create apps/api/services/persona.py.

Function: synthesize(product_idea: str, audience: RawAudience) -> Persona

Use OpenAI GPT-4o with response_format={"type": "json_object"}. Prompt:

  You are a brand strategist. Given a creator's audience signals and their
  product idea, synthesize a primary customer persona.

  PRODUCT IDEA: {product_idea}

  AUDIENCE SIGNALS:
  - Bio: {bio}
  - Follower count: {follower_count}
  - Top hashtags: {top_hashtags}
  - Recent post captions (sample of 10): {captions}
  - Accounts they engage with: {top_mentioned_accounts}

  Return JSON with this schema:
  {
    "name": "first name only, evocative",
    "age_range": "e.g. 22-28",
    "location_archetype": "e.g. 'urban creative cities — Brooklyn, Berlin, Tokyo'",
    "psychographics": ["3-5 short phrases"],
    "interests": ["5-8 specific interests, not generic"],
    "purchase_signals": ["3-4 things this person actually buys"],
    "aesthetic_keywords": ["5 words for the visual world they live in —
                           these will drive the brand visuals"],
    "voice_traits": ["3 adjectives for how the brand should speak to them"],
    "summary": "2 sentences, vivid, specific. No corporate speak."
  }

  Be specific and observational. Avoid demographics-only personas. Reference
  real cultural touchpoints when the data supports it.

Validate the JSON against a Pydantic model before returning. Retry once on
parse failure with a "your previous response was not valid JSON" follow-up.
```

---

### Task 6 — Logo + image generation

```
Create apps/api/services/brand.py.

Function: generate_logo(persona: Persona, product_idea: str, brand_name: str) -> str
  Returns a public URL to the logo PNG (uploaded to Supabase storage).

Use Replicate's FLUX.1 schnell model (black-forest-labs/flux-schnell) — 4 steps,
fast and cheap (~$0.003 per image). Build the prompt from persona.aesthetic_keywords:

  "Minimalist vector logo for a brand called '{brand_name}', {product_idea}.
   Aesthetic: {', '.join(persona.aesthetic_keywords)}. Clean lines, single color
   on transparent background, centered, iconic, memorable. No text, no letters,
   symbol only."

Negative cues to add: "photographic, 3d render, busy, cluttered, watermark, signature".

Aspect ratio 1:1, 1024x1024.

Function: generate_mockups(persona, brand_name, logo_url) -> list[str]
  Generate 2 mockups: tee and tote bag. For each, prompt FLUX to render
  the product on a flat-lay or model in the persona's aesthetic. Don't try
  to actually composite the logo — just describe the brand visually.

  Example tee prompt:
  "Editorial flat-lay photo of a heather-grey cotton tee with a small
   minimalist chest emblem, {persona.aesthetic_keywords[:3]} aesthetic,
   natural lighting, magazine quality, off-white background"

Function: generate_palette_and_fonts(persona) -> {colors: [...], fonts: {...}}
  Use GPT-4o to pick a 5-color palette (with hex + role: primary/secondary/
  accent/bg/fg) and 2 Google Fonts (display + body) that match the persona's
  aesthetic_keywords. Return JSON.

Function: generate_voice(persona) -> {tone: str, do: [...], dont: [...], examples: [...]}
  GPT-4o, JSON output. 3 do's, 3 dont's, 3 example one-liners (e.g. tagline,
  product card copy, social caption).

Upload all images to Supabase storage bucket 'brand-assets', return public URLs.
```

---

### Task 7 — Style guide assembly

```
Create apps/api/services/brand.py:assemble_brand_assets(...).

Combine outputs from Task 6 into a single BrandAssets object:
  {
    brand_name: str,        # generate via GPT-4o from product_idea + persona
    logo_url: str,
    palette: [{hex, role, name}],
    typography: {display: {family, google_url}, body: {family, google_url}},
    voice: {tone, do, dont, examples},
    mockups: [{label, url}]
  }

Brand name generation prompt (GPT-4o):
  "Suggest 5 brand name options for: {product_idea}, targeting {persona.summary}.
   Names should be: 1-2 syllables, easy to spell, not already a major brand,
   evocative of {persona.aesthetic_keywords}. Return JSON {names: [...]}.
   Then pick the best one and return it as 'recommended'."

Use the recommended name throughout downstream generation. Pass it back to logo
generation (so the logo prompt knows the brand name).

Order of operations: generate brand_name FIRST, then run logo + mockups +
palette + voice in parallel using asyncio.gather.
```

---

### Task 8 — Agency matching

```
Create apps/api/services/matching.py.

Seed apps/api/fixtures/agencies.json with 8-10 fake-but-plausible agencies.
Each agency:
  {
    id, name, blurb, specialty_tags: [...], aesthetic_tags: [...],
    notable_clients: [...], min_budget: "$5k", website
  }

Make them feel real — pull inspiration from real boutique branding shops
(but invent names). Vary specialties: streetwear, food/bev, beauty, tech,
sustainability, etc.

Function: match(persona: Persona) -> list[AgencyMatch]

Compute embeddings (OpenAI text-embedding-3-small) for:
  - persona vector: join(persona.aesthetic_keywords + persona.interests)
  - each agency vector: join(specialty_tags + aesthetic_tags)

Cosine similarity, return top 3 with match score (0-100, rescaled from cosine).

Cache agency embeddings on first call (in-memory dict is fine for hackathon).

For each match, generate a one-line "why this matches" using GPT-4o given
the persona summary and the agency blurb. Keep it under 20 words.
```

---

### Task 9 — PDF brand guide export

```
Create apps/api/services/export.py.

Function: build_pdf(brand_assets: BrandAssets, persona: Persona) -> str (URL)

Use WeasyPrint (pip install weasyprint). Render an HTML template with the
brand guide. Pages:
  1. Cover — brand name, tagline (from voice.examples[0]), logo
  2. The customer — persona card
  3. Logo — primary, mono variants (you can fake mono by CSS-filtering)
  4. Color palette — swatches with hex codes
  5. Typography — display + body samples with the actual Google Fonts
  6. Voice — tone, do/dont, example copy
  7. Mockups — full bleed images
  8. Back cover — "Generated by Halo, {date}"

Use a clean editorial CSS — generous margins, single accent color from the
brand's palette, the brand's display font in headings (load via Google Fonts).

Save to Supabase storage at brand-guides/{job_id}.pdf, return public URL.

Don't over-engineer the template; a single ~200 line HTML/CSS file is fine.
```

---

### Task 10 — Results page polish

```
Polish apps/web/app/jobs/[id]/page.tsx.

Add:
  - Skeleton loaders that morph into real content as it streams in
  - Smooth fade-in for each section (framer-motion or CSS @keyframes)
  - Color palette swatches that show hex on hover, copy-to-clipboard on click
  - Logo on a swappable background (white/black/brand-color toggle)
  - Mockup carousel or side-by-side
  - Match cards with the "why" line + "Connect" button
  - Sticky bottom bar with: Download PDF | Request quote | Share link

Make it feel like the user is unwrapping something. The reveal sequence
matters more than any single element.

Add a /demo route that's just /jobs/{cached_demo_job_id} — shortcut for the
pitch.
```

---

### Task 11 — Cache the demo creator (CRITICAL — do this last but allocate time)

```
Pick one real creator handle that we know works well (test with a few:
choose someone with strong aesthetic identity, public account, ~10k-100k
followers — too small = thin signal, too big = scraper rate limits).

Run the pipeline manually for them with one specific product_idea
(e.g. "matcha energy drink for late-night creatives").

Once it produces a great result:
  - Save the full job result to apps/api/cache/{handle}.json
  - Save all generated images to apps/api/cache/images/ and update URLs
    in the cached JSON to point to local /static paths
  - Set CACHE_MODE=true in production env
  - Confirm: hitting POST /jobs with that handle returns the cached result
    in <2 seconds (with fake stage delays so the UI animation still plays)

Document the demo handle + product idea in DEMO.md so the team knows
what to type on stage.

Also pre-generate a backup video of the demo in case wifi dies. OBS, 30
seconds, the full happy path.
```

---

## 6. Demo script (3 minutes on stage)

```
0:00  "Every creator with an audience is sitting on a brand. Most never build it
      because the gap from idea to product is huge — strategy, design,
      manufacturing, agencies. We collapsed that to one prompt."

0:20  Open Halo. Type: "matcha energy drink for late-night creatives"
      Handle: @[demo_creator]
      Click Generate.

0:30  Stages light up. Narrate: "We're scraping their audience, building a
      persona from real engagement signals, generating brand assets, matching
      agencies."

1:00  Persona reveals. Read 1 sentence aloud — point out a specific insight
      that proves it's grounded ("notice it picked up on the Berlin techno
      scene from her hashtag overlap").

1:30  Brand assets reveal. Show the logo, palette, mockups. "All of this in
      one pass. The logo's a real SVG, the brand guide is a real PDF, the
      mockups are mfg-ready specs."

2:10  Agency matches. "Three boutique agencies matched by audience embedding —
      not just category."

2:30  Click "Request manufacturing quote." Toast: sent. "From idea to vendor
      pipeline in under two minutes."

2:45  "We're building the GTM layer for the creator economy. Halo."

3:00  Q&A.
```

---

## 7. Risk register (skim now, refer to during the build)

| Risk | Mitigation |
|---|---|
| Apify rate-limits during demo | Cache (Task 11) |
| Replicate slow / queue | Pre-generate logo for cached creator; for live, FLUX schnell is ~3s |
| GPT-4o returns malformed JSON | Pydantic validation + 1 retry (built into Task 5) |
| Wifi dies on stage | Backup video (Task 11) |
| Persona feels generic | Tune the prompt with examples; force specificity in the schema |
| Logos look like AI slop | Iterate the prompt; constrain to "single color, vector, no text" hard |
| Time runs out | Cut Task 8 (matching) first, then Task 9 (PDF). Logo + persona is the wow. |

---

## 8. What to do right now (first 30 min)

1. Pick the name (Halo unless you hate it)
2. Create the repo, invite the team, push Task 0
3. Each person reads their assigned tasks and the demo script
4. One person creates accounts: OpenAI, Replicate, Apify, Supabase. Drop keys in shared `.env`
5. One person picks the demo creator handle and runs it through Apify manually to confirm the scrape works
6. Start Task 0, then fan out

Go.
