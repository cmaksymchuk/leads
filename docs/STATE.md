# LeadFlow — Data Model

## Tables

### raw_records
Append-only ingest. Payload is not rewritten by the app.
- id (uuid), source, external_id (nullable), payload (jsonb), ingested_at
- region (text, nullable)
- status (text, default `pending`)
- processed_at, processing_lock, processing_attempts, processing_error, failed_at
- skip_reason (text, nullable): soft-skip reason when processed but not promoted; null when promoted
- Unique partial index on `(source, external_id)` where `external_id` is not null

Migrations: `20250329120000_raw_records_capture.sql` (`status`, nullable `region`); `20250330120000_raw_records_skip_reason.sql` (`skip_reason`).

### leads
Promoted mortgage lead rows (qualification in app code).
- id, created_at, updated_at, fingerprint, contact_phone, address, city, postal_code, region, payment_shock, months_to_renewal, score, status (`available` | `sold`)

### lead_events
- id, lead_id (FK), event_type, payload (jsonb), idempotency_key (nullable), created_at

## Key constraints
- Batch claim: `claim_raw_records_for_processing` (FOR UPDATE SKIP LOCKED)
- RLS: enabled on `leads` and `lead_events`; no anon access. Service role on the server only.

## Processing lifecycle (logical)
Unprocessed work: `processed_at` null, `failed_at` null. Workers set `processing_lock`, then either finalize success (`processed_at`, optional `skip_reason`) or failure (`processing_error`, `failed_at` after max attempts — see app `MAX_RAW_PROCESSING_ATTEMPTS`).
