1. Supabase (database + optional Edge worker)

Create a project in Supabase Dashboard.

Apply the schema from this repo:

- SQL Editor: run migrations in order (`20250326120000_leadflow_init.sql` then `20250327120000_leadflow_canada_mvp.sql`), or
- Supabase CLI: `supabase link` then `supabase db push` (if you use the CLI workflow).

Collect credentials (Project Settings → API):

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- service_role key (secret, server-only) → `SUPABASE_SERVICE_ROLE_KEY`

Never expose this in the browser or commit it.

Optional — background path (Edge + webhook) per docs/WEBHOOK.md:

- Install Supabase CLI, log in, link the project.
- Deploy: `supabase functions deploy process-raw` (from repo root).
- Set Edge Function secrets (Dashboard → Edge Functions → process-raw → Secrets, or CLI):
  - `LEADFLOW_HMAC_SECRET` — long random string (must match Vercel).
  - `INTERNAL_PROCESS_URL` — `https://<your-vercel-domain>/api/process-raw`
- Database → Webhooks: on `public.raw_records` INSERT, call the Edge Function URL (or the URL Supabase gives for that function).

If you skip this, ingestion still works; you must manually call `POST /api/process-raw` with a valid HMAC to process rows (or add a Vercel Cron later).

2. Vercel (Next.js app)

Import the Git repo into Vercel and deploy (framework: Next.js).

Environment variables (Project → Settings → Environment Variables), for Production (and Preview if you want):

| Variable | Notes |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Same as Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret — Production only, not `NEXT_PUBLIC_*` |
| `LEADFLOW_HMAC_SECRET` | Same string as Edge (if you use the Edge webhook path) |
| `LEADFLOW_COMPLIANCE_FOOTER` | Optional — used by `POST /api/preview-outreach` |

Redeploy after saving env vars so the build/runtime picks them up.

Production URL: set `INTERNAL_PROCESS_URL` in Supabase Edge to `https://<your-production-domain>/api/process-raw`.

Preview deployments get random URLs — either disable webhooks for previews or use a stable production URL for the Edge secret.

3. Other things you should do

- Git / secrets: Ensure `.env.local` is gitignored (it usually is). Only set secrets in Vercel/Supabase dashboards.
- RLS: Migrations enable RLS with no policies for anon/authenticated; the app uses the service role on the server. When you add real users, add policies or a BFF pattern — do not expose the service role to the client.
- Smoke test after deploy:
  - `POST /api/ingest` with a valid Canada payload (see README).
  - If webhook+Edge is configured, confirm rows get `processed_at` set; otherwise call the processor with a signed request.
  - Open `/dashboard` and confirm promoted leads appear.

4. If you do not use the Edge Function yet

Minimum to run in production:

- Supabase project + migrations applied
- Vercel with `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LEADFLOW_HMAC_SECRET`
- Processing: either deploy Edge + webhook as above, or trigger `POST /api/process-raw` from a trusted system (cron, queue worker, manual script) with a correct HMAC — the app does not process `raw_records` on ingest alone.

Short version: Create Supabase → run the migrations → copy URL + service_role into Vercel → set `LEADFLOW_HMAC_SECRET` on Vercel → deploy → (optional) deploy Supabase Edge function + webhook with matching HMAC and `INTERNAL_PROCESS_URL` pointing at your live `/api/process-raw`.
