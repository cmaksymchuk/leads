-- LeadFlow: core schema (polymorphic leads, raw ingestion, events, scores, suppression)

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- -----------------------------------------------------------------------------
-- raw_records: immutable raw ingest; processing state + lock
-- -----------------------------------------------------------------------------

CREATE TABLE public.raw_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  external_id text,
  payload jsonb NOT NULL,
  ingested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  processing_lock boolean NOT NULL DEFAULT false,
  processing_attempts integer NOT NULL DEFAULT 0,
  processing_error text,
  failed_at timestamptz,
  CONSTRAINT raw_records_processing_attempts_nonnegative CHECK (processing_attempts >= 0)
);

CREATE UNIQUE INDEX raw_records_source_external_unique
  ON public.raw_records (source_type, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX raw_records_unprocessed_partial
  ON public.raw_records (ingested_at)
  WHERE processed_at IS NULL;

COMMENT ON TABLE public.raw_records IS 'Append-only raw payloads; never delete. processing_lock coordinates concurrent workers.';

-- Atomic lock: increments attempts only when lock acquired (single round-trip from app).
-- App enforces MAX attempts on failure (failed_at / skip re-lock).
CREATE OR REPLACE FUNCTION public.acquire_raw_record_lock(p_id uuid)
RETURNS SETOF public.raw_records
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.raw_records r
  SET
    processing_lock = true,
    processing_attempts = r.processing_attempts + 1
  WHERE r.id = p_id
    AND r.processing_lock = false
    AND r.processed_at IS NULL
    AND r.failed_at IS NULL
  RETURNING r.*;
$$;

-- -----------------------------------------------------------------------------
-- leads: unified entity; industry signal in metadata JSONB
-- -----------------------------------------------------------------------------

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lead_type text NOT NULL,
  status text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'qualified', 'routed', 'suppressed', 'failed')),
  fingerprint text NOT NULL,
  fingerprint_version integer NOT NULL DEFAULT 1,
  company_name text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  contact_email text,
  city text NOT NULL DEFAULT '',
  region text NOT NULL DEFAULT '',
  source_url text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  dedupe_key text,
  consent_basis text,
  consent_expiry timestamptz
);

CREATE UNIQUE INDEX leads_fingerprint_unique ON public.leads (fingerprint);
CREATE INDEX leads_dedupe_key_idx ON public.leads (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE INDEX leads_lead_type_idx ON public.leads (lead_type);
CREATE INDEX leads_status_idx ON public.leads (status);
CREATE INDEX leads_last_seen_idx ON public.leads (last_seen_at DESC);

-- Fuzzy / trigram helpers (normalized search)
CREATE INDEX leads_company_name_trgm ON public.leads USING gin (lower(company_name) gin_trgm_ops);
CREATE INDEX leads_contact_name_trgm ON public.leads USING gin (lower(contact_name) gin_trgm_ops);
CREATE INDEX leads_region_trgm ON public.leads USING gin (lower(region) gin_trgm_ops);

-- Optional fuzzy candidate lookup (pg_trgm). Must run after `leads` exists (RETURNS SETOF public.leads).
CREATE OR REPLACE FUNCTION public.match_leads_fuzzy(
  p_region text,
  p_company text,
  p_threshold real DEFAULT 0.35
)
RETURNS SETOF public.leads
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT *
  FROM public.leads
  WHERE length(trim(p_region)) > 0
    AND length(trim(p_company)) > 0
    AND lower(region) = lower(trim(p_region))
    AND similarity(lower(company_name), lower(trim(p_company))) > p_threshold
  ORDER BY similarity(lower(company_name), lower(trim(p_company))) DESC
  LIMIT 3;
$$;

-- -----------------------------------------------------------------------------
-- lead_events / lead_scores
-- -----------------------------------------------------------------------------

CREATE TABLE public.lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lead_events_idempotency_unique
  ON public.lead_events (lead_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX lead_events_lead_created ON public.lead_events (lead_id, created_at DESC);

CREATE TABLE public.lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads (id) ON DELETE CASCADE,
  score numeric NOT NULL,
  reasoning jsonb NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX lead_scores_idempotency_unique
  ON public.lead_scores (lead_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX lead_scores_lead_created ON public.lead_scores (lead_id, created_at DESC);

CREATE TABLE public.suppression_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX suppression_list_email_lower_unique ON public.suppression_list (lower(email));

-- -----------------------------------------------------------------------------
-- RLS: deny by default for anon/authenticated; service role bypasses RLS
-- -----------------------------------------------------------------------------

ALTER TABLE public.raw_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;

-- No policies: only service role (bypass) or future authenticated policies
