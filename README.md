# Halo

Prompt-to-brand engine. Handle in → persona, brand assets, mockups, agency matches, and a printable brand guide out.

## Structure

```
apps/
  web/          # Next.js 14 (App Router, TS, Tailwind, shadcn/ui)
  api/          # FastAPI (Pydantic v2, Supabase, OpenAI, Replicate, Apify)
packages/
  types/        # Shared TS types mirroring Pydantic schemas
start.md        # Full build plan (phases + demo script + risk register)
```

## Prerequisites

- Node 20+, pnpm 9+
- Python 3.11+
- Supabase project (URL + service key)
- API keys: OpenAI, Replicate, Apify

## Setup

```bash
# Install frontend deps
pnpm install

# Install backend deps
cd apps/api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cd ../..

# Copy env template and fill in keys
cp .env.example .env
cp .env.example apps/api/.env
```

## Run

```bash
# Web (http://localhost:3000)
pnpm dev:web

# API (http://localhost:8000)
pnpm dev:api
# or: cd apps/api && uvicorn main:app --reload
```

Healthcheck: `curl http://localhost:8000/health`

## Build plan

See [`start.md`](./start.md) for the phased build plan, demo script, and risk register.
