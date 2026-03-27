# LeadFlow — Data Model

## Tables

### raw_records
Append-only. Every ingest lands here first.
- id, source_type, external_id, payload (jsonb), status
- processing_state: pending | processing | processed | failed
- processing_attempts, processing_error, processed_at, failed_at
- skip_reason (why a processed row was not promoted)
- acquired_at (lock timestamp)

### leads
Promoted records. A row here means the record passed qualification.
- id, raw_record_id (FK), status, score, region
- phone, email (normalized)
- sold_at, sold_to (handoff fields)

## Key constraints
- Unique index on (source_type, external_id) for deduplication
- Atomic lock via acquire_raw_record_lock DB function
- RLS: no anon access. Service role only on the server.

## Processing states
pending → processing → processed (promoted or skipped with reason)
pending → processing → failed (after MAX_RAW_PROCESSING_ATTEMPTS)
