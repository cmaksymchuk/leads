-- First-party capture API: explicit ingest status; nullable region when unresolved

ALTER TABLE public.raw_records
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.raw_records
  ALTER COLUMN region DROP NOT NULL;
