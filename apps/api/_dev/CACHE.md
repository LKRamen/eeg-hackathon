# Demo cache (Task 4.11)

This directory is the cache served when `CACHE_MODE=true` for the demo
handle. Coordinated multi-team event — Person 1 wires the static
mounting, Person 3 drops in cached image renders, Person 4 drops in
the brand artifacts.

Layout per handle:

```
cache/
  {handle}/
    brand_assets.json     Person 4 — BrandAssets dump
    brand_guide.pdf       Person 4
    pitch_deck.pdf        Person 4
    mfg_spec.pdf          Person 4
    web_guide.html        Person 4
    brand_kit.zip         Person 4
    logo/*.png            Person 3 — cached image renders
    mockups/*.png         Person 3
    social/*.png          Person 3
```

To populate before a demo:

1. Run the full pipeline once on the demo handle (`DEMO_HANDLE` env).
2. Copy outputs from `cache/brand-guides/jobs/{job_id}/...` into
   `cache/{handle}/...`.
3. Inspect every artifact in person before locking — open every PDF,
   scroll every page, click everything in the web guide, unzip the kit.
4. Commit the cache so the demo machine has it without API calls.

`apps/api/cache/brand-guides/` (used as the local-storage fallback by
`_storage.upload_image` when no Supabase is configured) is git-ignored;
the curated demo cache committed here lives outside that subtree.
