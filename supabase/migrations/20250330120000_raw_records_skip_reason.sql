-- Persist why a raw_record was processed but not promoted (soft skips).

ALTER TABLE public.raw_records
  ADD COLUMN IF NOT EXISTS skip_reason text;
