# Phase 0 gaps to resolve before Phase 2 rendering

## WeasyPrint GTK runtime (Windows host)

`weasyprint==62.3` is installed via pip but CANNOT render PDFs on this
Windows 11 host because the GTK3 native libraries are missing.

```
OSError: cannot load library 'gobject-2.0-0': error 0x7e.
```

Fix (pick one before running Phase 2's brand-guide render):

1. **Install GTK3 for Windows runtime** (simplest, ~5 min):
   https://github.com/tschoonj/GTK-for-Windows-Runtime-Environment-Installer/releases
2. **Use WSL** (Ubuntu): `sudo apt install -y libpango-1.0-0
   libpangoft2-1.0-0 libcairo2` and run the API under WSL.
3. **Render on CI instead**: keep the code, skip local verification.

Phase 1 (GPT wrappers) does NOT need WeasyPrint — it runs green here.

## OpenAI key

`OPENAI_API_KEY` is empty. Phase 1 wrappers return deterministic
fixtures in that mode (see `_swarm_context.md`). To run against the
real model, set the key in `apps/api/.env` before invoking the
pipeline.

## Person 2 / Person 3 modules

`services.suggest_brand_name` (Person 2) and `images.*` (Person 3) are
not on disk yet. Phase 2 uses a stub at `services/_images_stub.py`
which returns placeholder URLs. Swap the stub import for the real
module once their code lands.
