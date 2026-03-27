-- LeadFlow Canada MVP v2: mortgage-focused leads, batch claiming, simplified schema

-- -----------------------------------------------------------------------------
-- raw_records: rename source_type -> source (blueprint)
-- -----------------------------------------------------------------------------
ALTER TABLE public.raw_records RENAME COLUMN source_type TO source;

-- -----------------------------------------------------------------------------
-- Drop legacy objects tied to polymorphic leads
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS public.lead_scores CASCADE;
DROP TABLE IF EXISTS public.suppression_list CASCADE;
DROP FUNCTION IF EXISTS public.match_leads_fuzzy(text, text, real) CASCADE;
DROP FUNCTION IF EXISTS public.acquire_raw_record_lock(uuid) CASCADE;

DROP TABLE IF EXISTS public.lead_events CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;

-- -----------------------------------------------------------------------------
-- leads: callable Canadian mortgage renewal leads
-- -----------------------------------------------------------------------------
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  fingerprint text NOT NULL,
  contact_phone text NOT NULL,
  address text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  payment_shock numeric NOT NULL DEFAULT 0,
  months_to_renewal integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'available'
    CHECK (status IN ('available', 'sold'))
);

CREATE UNIQUE INDEX leads_fingerprint_unique ON public.leads (fingerprint);
CREATE INDEX leads_status_idx ON public.leads (status);
CREATE INDEX leads_score_idx ON public.leads (score DESC);

COMMENT ON TABLE public.leads IS 'Canada MVP: deduped callable leads with renewal math and score on row.';

-- -----------------------------------------------------------------------------
-- lead_events
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

-- -----------------------------------------------------------------------------
-- Batch claim: FOR UPDATE SKIP LOCKED (blueprint Step 1)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.claim_raw_records_for_processing(p_limit integer DEFAULT 10)
RETURNS SETOF public.raw_records
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH cte AS (
    SELECT id
    FROM public.raw_records
    WHERE processed_at IS NULL
      AND processing_lock = false
      AND failed_at IS NULL
    ORDER BY ingested_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.raw_records AS r
  SET processing_lock = true
  FROM cte
  WHERE r.id = cte.id
  RETURNING r.*;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_events ENABLE ROW LEVEL SECURITY;
