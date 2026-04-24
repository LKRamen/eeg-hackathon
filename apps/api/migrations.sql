-- Run this once in the Supabase SQL editor:
-- https://supabase.com/dashboard/project/gxreiszlfveviouwwpfj/sql/new

CREATE TABLE IF NOT EXISTS public.jobs (
    id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       text,
    handle        text        NOT NULL,
    product_idea  text        NOT NULL,
    platform      text        NOT NULL DEFAULT 'instagram',
    status        text        NOT NULL DEFAULT 'queued',
    created_at    timestamptz NOT NULL DEFAULT now(),
    error_message text,
    result        jsonb
);

-- Allow all operations for now (tighten before production)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon full access" ON public.jobs
    FOR ALL USING (true) WITH CHECK (true);
