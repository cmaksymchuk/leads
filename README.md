# LeadFlow Canada (MVP)

Canadian property ingest → raw storage → batch processor (renewal math, payment shock, score) → **callable** leads on `public.leads`. Dashboard at `/dashboard`.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind, shadcn/ui
- Supabase (Postgres) — migrations in `supabase/migrations/`
- Zod validation
- Supabase Edge Function (`supabase/functions/process-raw`) POSTs to Next.js with HMAC to run the batch processor

## Setup

1. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `LEADFLOW_HMAC_SECRET`.
2. Apply DB migrations (Supabase CLI or SQL editor), including `20250327120000_leadflow_canada_mvp.sql` after the init migration.
3. `npm install` && `npm run dev`

## API

- `POST /api/ingest` — body `{ "source": "<name>", "external_id": "...", "payload": { ... } }` with a Canada mortgage payload (see below). Stores **only** `raw_records`.
- `POST /api/process-raw` — HMAC-signed (`X-LeadFlow-Timestamp`, `X-LeadFlow-Signature`). Optional JSON `{ "limit": 10 }`. Claims up to `limit` rows with `SKIP LOCKED`, runs mortgage MVP logic, promotes high-intent leads.
- `POST /api/preview-outreach` — `{ "leadId": "<uuid>" }` returns a **dry-run** message text (no sends).

## Webhook / Edge

See [docs/WEBHOOK.md](docs/WEBHOOK.md). Point `INTERNAL_PROCESS_URL` at `https://<your-domain>/api/process-raw`.

## Example ingest

```json
{
  "source": "csv_import_2025",
  "external_id": "row-42",
  "payload": {
    "purchase_price": 650000,
    "purchase_date": "2020-06-01",
    "contact_phone": "+14035550123",
    "address": "100 Main Street",
    "city": "Calgary",
    "postal_code": "T2P 1J9"
  }
}
```

<!-- No functional change; doc-only. -->
