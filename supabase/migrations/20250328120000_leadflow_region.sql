-- Provincial segmentation: region on raw + leads, index for filtering.
-- Fingerprint semantics in app code now hash (address|city|region); existing
-- fingerprint values are not auto-migrated — re-ingest or backfill if needed.

ALTER TABLE public.raw_records
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '';

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS leads_region_idx ON public.leads (region);

COMMENT ON COLUMN public.leads.region IS 'Province/territory code (e.g. ON, BC); included in lead fingerprint hash.';
