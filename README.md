# LeadFlow

Polymorphic lead generation platform: raw ingest → adapters → fingerprint/dedupe → workflow (enrich / score / route) → optional delivery.

## Stack

- Next.js 16 (App Router), TypeScript strict, Tailwind, shadcn/ui
- Supabase (Postgres) — migrations in `supabase/migrations/`
- Zod validation
- Thin Supabase Edge Function (`supabase/functions/process-raw`) forwards to Next.js with HMAC

## Setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `LEADFLOW_HMAC_SECRET`.
2. Apply DB migrations (Supabase CLI or SQL editor).
3. `npm install` && `npm run dev`

## API

- `POST /api/ingest` — body `{ "source_type": "generic_json", "payload": { ... } }` (or `{ "lead": { ... } }`). Stores **only** `raw_records`.
- `POST /api/internal/process-raw` — HMAC-signed (`X-LeadFlow-Timestamp`, `X-LeadFlow-Signature`), body `{ "rawRecordId": "<uuid>" }`. Used by the Edge Function or manual replay.
- `POST /api/preview-outreach` — `{ "leadId": "<uuid>" }` returns a **dry-run** message text (no sends).

## Webhook / Edge

See [docs/WEBHOOK.md](docs/WEBHOOK.md).

## Dashboard

Open `/dashboard` for leads, filters, and detail (metadata, events, scores).

## Example ingest (`generic_json`)

```json
{
  "source_type": "generic_json",
  "payload": {
    "lead_type": "real_estate",
    "company_name": "Acme Realty",
    "contact_name": "Jane Doe",
    "contact_email": "jane@example.com",
    "city": "Calgary",
    "region": "AB",
    "source_url": "https://example.com/listing/1",
    "metadata": {
      "signal_type": "listing",
      "property_value": 450000
    }
  }
}
```
