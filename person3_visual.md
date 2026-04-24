# Person 3 — Visual Asset Generation

You own **every pixel the user sees**. Logos, mockups, social posts, avatar — all the imagery that makes the brand feel real. Your output is the most demoable part of the project. If your assets look like Midjourney defaults, the demo dies. If they look like a real brand campaign, judges sit up.

## Your scope

- Replicate / FLUX integration
- Image storage helpers (Supabase upload)
- Logo generation (with serious prompt iteration)
- Logo variants — primary, mono dark, mono light, on-brand-color, avatar
- Product mockups — tee, tote (P0); hat, sticker sheet (P1)
- Social asset kit — 3 IG square posts + 2 story templates (P1, was in original spec)
- Asset quality iteration

You do **not** own: palette, typography, voice, PDF, assembly orchestrator. Those are Person 4. You hand Person 4 a `VisualAssets` object and they merge it with their data into the final `BrandAssets`.

## What you produce (Person 4 imports these)

| Module | Function | Returns |
|---|---|---|
| `services/storage.py` | `async upload_image(bytes, bucket, path) -> str` | public URL |
| `services/storage.py` | `async upload_url(url, bucket, path) -> str` | rehosted URL |
| `services/images.py` | `async generate_logo_set(brand_name, product_idea, persona, job_id) -> LogoVariants` | 5 logo URLs |
| `services/images.py` | `async generate_mockups(brand_name, persona, job_id) -> list[Mockup]` | 2–4 mockups |
| `services/images.py` | `async generate_social_kit(brand_name, tagline, persona, job_id) -> list[SocialAsset]` | 5 social posts |

Person 4 calls these in parallel from their `brand.assemble()` orchestrator.

## What you depend on

| From | What |
|---|---|
| Person 1 | `models.schemas` (Pydantic types), `db.get_supabase()` |
| Person 2 | `Persona` shape — especially `aesthetic_keywords`, `voice_traits` |
| Person 4 | The brand_name and tagline (they generate these before calling you) |

## Contracts (the visual subset)

```python
class LogoVariants(BaseModel):
    primary: str        # full-color logo on white bg
    mono_dark: str      # solid black on transparent
    mono_light: str     # solid white on transparent (for dark bgs)
    on_brand: str       # logo composed on primary brand color
    avatar: str         # tight square crop optimized for circular display

class Mockup(BaseModel):
    label: Literal["tee", "tote", "hat", "sticker"]
    url: str

class SocialAsset(BaseModel):
    label: str          # "ig_post_hero", "ig_post_lifestyle", "ig_story_launch", etc.
    url: str
    format: Literal["ig_square", "ig_story"]
```

**The single most important input you receive is `persona.aesthetic_keywords`.** Those 5 visual words drive every prompt you write. If Person 2's keywords are vague ("modern, clean"), your logos will be slop. If they're specific ("matte black, brutalist concrete, Tokyo neon"), you can do real work. Push back on Person 2 if their keywords are weak — they have an explicit instruction to make them visual.

---

## Your tasks

### Task 3.0 — Setup (hr 0–1)

```
Sign up for Replicate (replicate.com). Add a payment method — FLUX schnell
is ~$0.003/image, you'll spend < $10 total even with heavy iteration.
Get REPLICATE_API_TOKEN from settings, drop in team .env channel.

Local install:
  pip install replicate pillow httpx

Verify:
  python -c "import replicate; print(replicate.models.get('black-forest-labs/flux-schnell'))"

Wait for Person 1 to push apps/api/models/schemas.py before writing services.
Don't define your own Pydantic types.

Note on FLUX models:
  - flux-schnell: 4 steps, ~3s, $0.003/image — DEFAULT
  - flux-dev: 28 steps, ~10s, $0.025/image — for hero logo if schnell is rough
  - flux-pro: ~$0.05/image — only for the demo logo if you have budget left

Start with schnell everywhere. Upgrade specific images later if quality matters.
```

---

### Task 3.1 — Storage upload helpers (hr 1–2)

```
Create apps/api/services/storage.py.

Functions:

  async def upload_image(
      image_bytes: bytes,
      bucket: Literal["brand-assets", "brand-guides"],
      path: str,
      content_type: str = "image/png",
  ) -> str:
      """Upload bytes to Supabase storage, return public URL."""
      supabase = get_supabase()
      supabase.storage.from_(bucket).upload(
          path=path,
          file=image_bytes,
          file_options={"content-type": content_type, "upsert": "true"},
      )
      return supabase.storage.from_(bucket).get_public_url(path)

  async def upload_url(
      image_url: str, bucket: str, path: str
  ) -> str:
      """Download from URL, upload to Supabase, return public URL.
      Use this for rehosting Replicate output URLs (which expire after ~1hr).
      """
      async with httpx.AsyncClient(timeout=30) as client:
          resp = await client.get(image_url)
          resp.raise_for_status()
          return await upload_image(resp.content, bucket, path)

  async def upload_pil(
      img: PIL.Image.Image, bucket: str, path: str, format: str = "PNG"
  ) -> str:
      """Save a PIL image and upload."""
      buf = io.BytesIO()
      img.save(buf, format=format)
      buf.seek(0)
      return await upload_image(buf.getvalue(), bucket, path,
                                content_type=f"image/{format.lower()}")

Test: upload a 1x1 PNG and confirm the public URL loads in a browser.
```

---

### Task 3.2 — Logo generation, primary version (hr 2–5)

```
Create apps/api/services/images.py.

Function:
  async def generate_logo_primary(
      brand_name: str,
      product_idea: str,
      persona: Persona,
      job_id: str,
  ) -> str:
      """Generate the primary color logo on white. Returns Supabase URL."""

Use Replicate FLUX schnell:

  output = await replicate.async_run(
      "black-forest-labs/flux-schnell",
      input={
          "prompt": prompt,
          "aspect_ratio": "1:1",
          "num_outputs": 1,
          "output_format": "png",
          "num_inference_steps": 4,
      },
  )
  replicate_url = output[0]
  # rehost
  return await storage.upload_url(
      replicate_url, "brand-assets", f"jobs/{job_id}/logo_primary.png"
  )

PROMPT ENGINEERING — THIS IS WHERE THE WORK IS.

Starting template:

  f"Iconic minimalist vector logo mark for the brand '{brand_name}'. "
  f"The brand makes: {product_idea}. "
  f"Visual aesthetic: {', '.join(persona.aesthetic_keywords)}. "
  f"A single bold geometric shape or symbol — not literal, not illustrative. "
  f"Solid color on pure white background. Centered. "
  f"Designed for scaling: must read clearly at 16x16 pixels. "
  f"Inspiration: 1960s Swiss design, Saul Bass film posters, "
  f"early MTV bumpers, brutalist signage. "
  f"NEGATIVE: no text, no letters, no typography, no words, "
  f"no 3D rendering, no gradients, no drop shadows, no photorealism, "
  f"no compound logos, no detailed illustrations, no busy compositions, "
  f"no watermarks, no signatures, no AI signatures, no mascots."

Iteration playbook — when output is bad, try in order:

  1. Output too busy → add "single shape only", remove "geometric"
  2. Output too generic → add a specific historical reference matching
     the persona ("inspired by 1980s Tokyo subway signage" if Tokyo
     neon is in keywords)
  3. Output is a swirl → add "angular, sharp edges" or "hard geometry"
  4. Output has weird text → strengthen negative: "absolutely no
     letterforms, no glyphs, no symbols resembling letters"
  5. Output is photorealistic → add "vector flat 2D illustration only,
     not a photograph"
  6. Output is mid → switch to flux-dev (10s, 8x cost) for hero only

Run on the demo persona 6-10 times. Save all candidates to a comparison
folder. Pick the best, reverse-engineer what made it work, bake into
template.

Then test the prompt template on 3 wildly different personas (e.g.
matte-black-brutalist, soft-cream-organic, Y2K-chrome). Confirm it
adapts. If all three look samey, your prompt is over-specifying — let
aesthetic_keywords do more of the work.
```

---

### Task 3.3 — Logo variants (hr 5–8)

```
Add to apps/api/services/images.py:

  async def generate_logo_set(
      brand_name: str,
      product_idea: str,
      persona: Persona,
      brand_color_hex: str,    # primary color from Person 4's palette
      job_id: str,
  ) -> LogoVariants:
      """Generate all 5 logo variants. Returns LogoVariants object.
      
      Strategy: generate primary via Replicate, derive the others via
      Pillow image processing. Avoids 5 separate API calls and keeps
      the variants visually consistent.
      """

Step 1: Get primary logo (Task 3.2 function).

Step 2: Process variants using Pillow (PIL):

  from PIL import Image, ImageOps
  import io, httpx
  
  # Download the primary
  resp = httpx.get(primary_url)
  primary = Image.open(io.BytesIO(resp.content)).convert("RGBA")

Step 3: Build mono_dark — convert to high-contrast black on transparent:

  def to_mono(img: Image.Image, color: tuple[int,int,int]) -> Image.Image:
      gray = img.convert("L")
      # threshold so anything not near-white becomes the target color
      mask = gray.point(lambda v: 0 if v > 230 else 255)
      out = Image.new("RGBA", img.size, (*color, 0))
      solid = Image.new("RGBA", img.size, (*color, 255))
      out.paste(solid, (0, 0), mask)
      return out

  mono_dark = to_mono(primary, (0, 0, 0))
  mono_light = to_mono(primary, (255, 255, 255))

Step 4: Build on_brand — paste primary onto a brand-color background:

  hex_to_rgb = lambda h: tuple(int(h[i:i+2], 16) for i in (1, 3, 5))
  bg = Image.new("RGBA", primary.size, (*hex_to_rgb(brand_color_hex), 255))
  on_brand = Image.alpha_composite(bg, mono_light)  # white logo on color

Step 5: Build avatar — square crop, generous padding, optimized for
circular profile picture display:

  def make_avatar(img: Image.Image, brand_color_hex: str) -> Image.Image:
      bg_rgb = hex_to_rgb(brand_color_hex)
      # Use mono_light on brand color, then add 15% padding
      padded = Image.new("RGBA", (1024, 1024), (*bg_rgb, 255))
      logo = mono_light.resize((720, 720), Image.LANCZOS)
      padded.paste(logo, ((1024-720)//2, (1024-720)//2), logo)
      return padded

  avatar = make_avatar(primary, brand_color_hex)

Step 6: Upload all 5 to Supabase under jobs/{job_id}/logo_*.png and
return LogoVariants.

Do all uploads in parallel:
  primary_url, mono_dark_url, mono_light_url, on_brand_url, avatar_url = (
      await asyncio.gather(
          upload_pil(primary, "brand-assets", f"jobs/{job_id}/logo_primary.png"),
          upload_pil(mono_dark, "brand-assets", f"jobs/{job_id}/logo_mono_dark.png"),
          ...
      )
  )

Test: render all 5 variants for a sample persona, view them in a 5-up
grid. Mono dark should look identical to mono light shape-wise. Avatar
should look good in a circular crop (test by overlaying a circle mask).
```

---

### Task 3.4 — Mockups: tee + tote (P0, hr 8–10)

```
Add to apps/api/services/images.py:

  async def generate_mockup(
      label: Literal["tee", "tote", "hat", "sticker"],
      brand_name: str,
      persona: Persona,
      job_id: str,
  ) -> Mockup

Per-product prompt builders. Don't try to composite the actual logo —
FLUX won't do it cleanly. Generate believable lifestyle photos with
small abstract emblems.

TEE template:
  f"Editorial product photograph of a high-quality {tee_color} cotton "
  f"crewneck t-shirt, {persona.aesthetic_keywords[0]} and "
  f"{persona.aesthetic_keywords[1]} aesthetic. Small minimalist "
  f"abstract emblem at left chest. Flat lay on a {surface} surface. "
  f"Natural daylight, 50mm lens, magazine quality, shallow depth of "
  f"field, slight wrinkles for realism. No people. "
  f"NEGATIVE: no text, no readable letters, no logos with text, no "
  f"watermarks, no model, no mannequin, no graphic design overlays."

Where {tee_color} and {surface} adapt to the aesthetic:
  brutalist → tee_color="charcoal grey", surface="raw concrete slab"
  organic → tee_color="natural cream", surface="oak wood plank"
  Y2K → tee_color="bright white", surface="iridescent acrylic"
  default → tee_color="heather grey", surface="linen backdrop"

Build a small dict mapping the first 1–2 keywords of
persona.aesthetic_keywords to (color, surface). Default fallback.

TOTE template:
  f"Editorial product photograph of a heavyweight canvas tote bag "
  f"hanging on a {hook_style} against a {wall} wall, "
  f"{persona.aesthetic_keywords[0]} and {persona.aesthetic_keywords[2]} "
  f"aesthetic. Small minimalist abstract emblem on front face. Natural "
  f"daylight from window left, soft shadows. Magazine quality. No "
  f"people. NEGATIVE: no text, no readable logos, no watermarks, no "
  f"hands, no model."

Same pattern: {hook_style} and {wall} swap by aesthetic.

For each mockup:
  1. Call FLUX schnell, aspect_ratio="1:1"
  2. Rehost to Supabase under jobs/{job_id}/mockup_{label}.png
  3. Return Mockup(label=..., url=...)

Run tee and tote in parallel:
  tee_task = generate_mockup("tee", ...)
  tote_task = generate_mockup("tote", ...)
  results = await asyncio.gather(tee_task, tote_task)
```

---

### Task 3.5 — Mockups: hat + sticker pack (P1, hr 10–12)

```
HAT template:
  f"Editorial product photograph of a structured 6-panel cap, "
  f"{cap_color} crown with {brim_color} brim, "
  f"{persona.aesthetic_keywords[0]} aesthetic. Small embroidered "
  f"abstract emblem on front panel. Side angle, displayed on a "
  f"matte {surface} surface, no model. Natural daylight, magazine "
  f"quality. NEGATIVE: no text, no readable logos, no watermarks, "
  f"no person, no head, no mannequin."

STICKER PACK template:
  f"Top-down product photograph of a small pile of die-cut vinyl "
  f"stickers scattered on a {surface}, 4-5 stickers visible. Each "
  f"sticker is a different abstract minimalist shape in "
  f"{persona.aesthetic_keywords[0]} aesthetic. Mix of solid color "
  f"shapes. Crisp shadows, glossy finish. Magazine product photography. "
  f"NEGATIVE: no text on stickers, no letters, no readable logos, no "
  f"hands, no watermarks."

Same pattern as Task 3.4. Add to the mockups list returned by
generate_mockups().

Update generate_mockups signature:

  async def generate_mockups(
      brand_name: str,
      persona: Persona,
      job_id: str,
      include: list[str] = ["tee", "tote", "hat", "sticker"],
  ) -> list[Mockup]:
      tasks = [generate_mockup(label, ...) for label in include]
      return await asyncio.gather(*tasks)

Person 4 can pass include=["tee", "tote"] if they want to skip extras.
```

---

### Task 3.6 — Social asset kit (P1, hr 12–15, this was in the original spec)

```
Add to apps/api/services/images.py:

  async def generate_social_kit(
      brand_name: str,
      tagline: str,
      persona: Persona,
      logo_url: str,        # mono dark for compositing
      brand_color_hex: str,
      job_id: str,
  ) -> list[SocialAsset]

5 assets total:
  - ig_post_hero (1080x1080) — logo announcement
  - ig_post_lifestyle (1080x1080) — product/scene with the brand vibe
  - ig_post_quote (1080x1080) — typographic quote post with tagline
  - ig_story_launch (1080x1920) — coming soon style
  - ig_story_closeup (1080x1920) — atmospheric close-up

Two generation strategies — use both:

STRATEGY A: pure Replicate generation (lifestyle, story_closeup)
  Aspect ratio "1:1" for square, "9:16" for story. Same FLUX schnell
  call as mockups. Prompt examples:

  ig_post_lifestyle:
    f"Atmospheric lifestyle photograph in {persona.aesthetic_keywords[0]} "
    f"and {persona.aesthetic_keywords[1]} aesthetic. {scene_for_aesthetic}. "
    f"Editorial composition, magazine quality, natural light, no people "
    f"or with one anonymous figure from behind. Square 1:1 composition. "
    f"NEGATIVE: no text, no overlays, no watermarks, no logos."

  ig_story_closeup:
    f"Atmospheric vertical photograph, extreme close-up texture or "
    f"detail shot. {persona.aesthetic_keywords[0]} aesthetic. "
    f"Cinematic, moody, vertical 9:16 composition for mobile. "
    f"NEGATIVE: no text, no overlays."

STRATEGY B: Pillow composition (hero, quote, story_launch)
  Composite the mono logo + tagline text on solid color backgrounds.
  This is more reliable than asking FLUX to render text.

  Helper:
    def compose_text_post(
        size: tuple[int,int],
        bg_hex: str,
        logo_img: Image.Image | None,
        text: str | None,
        font_path: str,
        text_color_hex: str,
    ) -> Image.Image:
        bg = Image.new("RGB", size, hex_to_rgb(bg_hex))
        # ... use ImageDraw to center text and paste logo

  ig_post_hero: bg=brand_color, logo centered (mono_light version)
  ig_post_quote: bg=fg_color, tagline centered in display font
  ig_story_launch: bg=brand_color, "COMING SOON" + brand_name stacked

  Get a TTF for the brand's display font. Person 4's typography output
  has the Google Font family name — download the TTF on demand:

    def get_google_font_ttf(family: str) -> Path:
        slug = family.replace(" ", "")
        url = f"https://fonts.googleapis.com/css2?family={family.replace(' ', '+')}:wght@700"
        # parse the CSS to find the actual font file URL
        # (regex for url(...) inside the @font-face)
        # download to /tmp/fonts/{slug}.ttf
        # cache so we don't redownload

  Or simpler: bundle 4–5 known good fonts as TTFs in apps/api/assets/fonts/
  and pick the closest match by name. Pre-download Inter, Space Grotesk,
  DM Sans, Fraunces, JetBrains Mono — covers most aesthetics.

Composition examples (pseudocode):

  hero = compose_text_post(
      size=(1080, 1080),
      bg_hex=brand_color_hex,
      logo_img=mono_light_logo.resize((400, 400)),
      text=None,
      ...
  )

  quote = compose_text_post(
      size=(1080, 1080),
      bg_hex=fg_color_hex,
      logo_img=None,
      text=tagline,
      font_path=display_font_ttf,
      text_color_hex=bg_color_hex,  # inverse of bg
  )

Upload each to jobs/{job_id}/social_{label}.png. Return list of
SocialAsset.

If Strategy B feels too fiddly to finish in time, ship just Strategy A
posts (3 of 5) and skip the typography ones. Budget no more than 3
hours on this task total — it's P1, not P0.
```

---

### Task 3.7 — Quality iteration (hr 15–17)

```
Spend a full block here. Asset quality is the demo.

Create apps/api/_dev/quality_grid.py — a script that:
  1. Loads the demo persona
  2. Generates 6 logos (different prompt variants), 3 mockups per type,
     5 social assets
  3. Builds an HTML page that shows them all in a grid
  4. Saves to /tmp/grid.html, opens in browser

Iterate the prompt templates until the grid looks editorial.

Specific things to push on:

  LOGO
    - Does it scale to 32x32 favicon and still read?
    - Could a designer actually trace this as a vector?
    - Does it have a single clear silhouette?
    - Anti-pattern: the FLUX "infinity loop with sparkle" default

  MOCKUPS
    - Does it look like a real product photo or a generated one?
    - Does the small emblem feel appropriate (not too prominent)?
    - Is the surface/lighting consistent with the brand aesthetic?

  SOCIAL
    - Hero post: does the logo + brand color feel iconic?
    - Lifestyle: would this fit on a real brand's IG grid?
    - Quote: is the typography rendering cleanly (no weird kerning)?

Once you're happy, lock the prompt templates and don't touch them again.
```

---

### Task 3.8 — Integration with Person 4 (hr 17–18)

```
Person 4 is calling your functions from their brand.assemble() orchestrator.
They'll call them roughly like this:

  # Person 4's pseudocode
  brand_name, _ = await persona_svc.suggest_brand_name(...)  # P2's func
  voice = await self.generate_voice(...)
  palette = await self.generate_palette(...)
  typography = await self.generate_typography(...)
  
  # Now your stuff — in parallel:
  logo_set = await images.generate_logo_set(
      brand_name, product_idea, persona,
      brand_color_hex=palette[0].hex,  # primary
      job_id=job_id,
  )
  mockups = await images.generate_mockups(brand_name, persona, job_id)
  social = await images.generate_social_kit(
      brand_name, voice.examples[0], persona,
      logo_url=logo_set.mono_dark,
      brand_color_hex=palette[0].hex,
      job_id=job_id,
  )

Confirm with Person 4:
  - Your function signatures match what they're calling
  - They pass you brand_color_hex BEFORE you generate (you need it for
    avatar background and on_brand logo)
  - The order of operations: Person 4's palette generation must complete
    before they call your generate_logo_set
  - You return the right types so their BrandAssets builds cleanly

If any module signature changes, ping Person 4 immediately. Don't let
the integration discover a mismatch at hour 20.
```

---

### Task 3.9 — Demo cache contribution (hr 18–20)

```
With Person 4 and Person 1, run the full pipeline ONCE for the demo handle
once everything is wired up. Then:

  1. Save all generated images to apps/api/cache/images/{handle}/
       logo_primary.png, logo_mono_dark.png, ..., logo_avatar.png
       mockup_tee.png, mockup_tote.png, mockup_hat.png, mockup_sticker.png
       social_ig_post_hero.png, social_ig_post_lifestyle.png, ...
  2. Person 1 will rewrite the URLs in the cached job result to point
     to /static/{handle}/{filename}
  3. Confirm those /static URLs load when CACHE_MODE=true

These cached files are your insurance. If Replicate is slow or down
during the demo, the cached path serves instantly.
```

---

## How to test without blocking on others

You don't need P1's pipeline or P2's persona. Hardcode a test persona:

```python
# apps/api/_dev/test_visuals.py
import asyncio
from models.schemas import Persona
from services.images import generate_logo_set, generate_mockups, generate_social_kit

test_persona = Persona(
    name="Mio",
    age_range="24-29",
    location_archetype="Brooklyn, Lisbon, Mexico City",
    psychographics=["values craft over hype"],
    interests=["natural wine", "minimalist techno"],
    purchase_signals=["small-batch coffee"],
    aesthetic_keywords=["matte black", "brutalist concrete", "Tokyo neon",
                        "raw edges", "monospace type"],
    voice_traits=["dry", "observational", "knowing"],
    summary="...",
)

async def main():
    logos = await generate_logo_set(
        "Hush", "matcha energy drink", test_persona,
        brand_color_hex="#0a0a0a", job_id="test-job"
    )
    print("Logos:", logos.model_dump_json(indent=2))
    mockups = await generate_mockups("Hush", test_persona, "test-job")
    print("Mockups:", [m.url for m in mockups])
    social = await generate_social_kit(
        "Hush", "Don't sleep on it.", test_persona,
        logo_url=logos.mono_dark, brand_color_hex="#0a0a0a",
        job_id="test-job"
    )
    print("Social:", [s.url for s in social])

asyncio.run(main())
```

This is your inner loop. Run after every prompt change.

---

## Coordination with Person 4 (the tightest coupling on the team)

You and P4 share the visual+brand surface. Sync 3 times:

  - **Hr 2**: agree on function signatures (paste them in chat, both confirm)
  - **Hr 10**: P4 has palette working; you grab a real `brand_color_hex` from
    their output and confirm logo variants render correctly with it
  - **Hr 17**: integration test on the demo persona, end-to-end through
    P4's `assemble()`

If P4 is slow on palette: hardcode `brand_color_hex="#000000"` for now,
swap when ready.

If you're slow on logo set: P4 can call generate_logo_primary() only and
build a stub LogoVariants where mono_dark/mono_light/on_brand/avatar all
point to the primary. Ugly but unblocks the PDF.

---

## Time budget

| Block | Hours | Tasks |
|---|---|---|
| Setup + storage | 0–2 | 3.0, 3.1 |
| Logo iteration | 2–8 | 3.2, 3.3 |
| Mockups core | 8–12 | 3.4, 3.5 |
| Social kit | 12–15 | 3.6 (cut if behind) |
| Quality pass | 15–17 | 3.7 |
| Integration + cache | 17–20 | 3.8, 3.9 |

If behind by hr 12, cut social kit (Task 3.6) and the hat+sticker mockups
(Task 3.5). Logo set + tee + tote is enough to demo well.

---

## What to do right now

1. Get Replicate token, add payment method, ping team in chat
2. Wait 60–90 min for P1 to publish schemas.py
3. Run Task 3.0 + Task 3.1 (~90 min total)
4. Burn the rest of the day on Task 3.2 (logo) — quality matters more
   than throughput
5. Confirm function signatures with P4 by hr 2

Make the brand look real. Spend the time.
