1. Supabase (database + optional Edge worker)
Create a project in Supabase Dashboard.
Apply the schema from this repo:
SQL Editor: paste and run the contents of supabase/migrations/20250326120000_leadflow_init.sql, or
Supabase CLI: supabase link then supabase db push (if you use the CLI workflow).
Collect credentials (Project Settings → API):
Project URL → NEXT_PUBLIC_SUPABASE_URL
service_role key (secret, server-only) → SUPABASE_SERVICE_ROLE_KEY
Never expose this in the browser or commit it.
Optional — background path (Edge + webhook) per docs/WEBHOOK.md:
Install Supabase CLI, log in, link the project.
Deploy: supabase functions deploy process-raw (from repo root).
Set Edge Function secrets (Dashboard → Edge Functions → process-raw → Secrets, or CLI):
LEADFLOW_HMAC_SECRET — long random string (must match Vercel).
INTERNAL_PROCESS_URL — https://<your-vercel-domain>/api/internal/process-raw
Database → Webhooks: on public.raw_records INSERT, call the Edge Function URL (or the URL Supabase gives for that function).
If you skip this, ingestion still works; you must manually call POST /api/internal/process-raw with a valid HMAC to process rows (or add a Vercel Cron later).
2. Vercel (Next.js app)
Import the Git repo into Vercel and deploy (framework: Next.js).

Environment variables (Project → Settings → Environment Variables), for Production (and Preview if you want):

Variable	Notes
NEXT_PUBLIC_SUPABASE_URL	Same as Supabase project URL
SUPABASE_SERVICE_ROLE_KEY	service_role secret — Production only, not NEXT_PUBLIC_*
LEADFLOW_HMAC_SECRET	Same string as Edge (if you use the Edge webhook path)
LEADFLOW_WEBHOOK_URL	Optional — outbound routing webhook
LEADFLOW_DRY_RUN	Optional — true to skip real outbound delivery HTTP
LEADFLOW_COMPLIANCE_FOOTER	Optional — used by POST /api/preview-outreach
Redeploy after saving env vars so the build/runtime picks them up.

Production URL: set INTERNAL_PROCESS_URL in Supabase Edge to
https://<your-production-domain>/api/internal/process-raw
Preview deployments get random URLs — either disable webhooks for previews or use a stable production URL for the Edge secret.

3. Other things you should do
Git / secrets: Ensure .env.local is gitignored (it usually is). Only set secrets in Vercel/Supabase dashboards.
RLS: Migrations enable RLS with no policies for anon/authenticated; the app uses the service role on the server. When you add real users, add policies or a BFF pattern — don’t expose the service role to the client.
Smoke test after deploy:
POST /api/ingest with source_type: "generic_json" and a valid payload (see README).
If webhook+Edge is configured, confirm the row gets processed_at set; otherwise call the internal processor with a signed request (or temporarily run processing locally against prod — only if you accept the risk).
Open /dashboard and confirm the lead appears.
Optional outbound webhook: set LEADFLOW_WEBHOOK_URL on Vercel if you want route() to POST somewhere.
Custom domain: Add in Vercel, then update INTERNAL_PROCESS_URL in Supabase Edge if it pointed at the old *.vercel.app URL.
Observability: Use Vercel Runtime Logs and Supabase Logs for failed raw_records (processing_error, failed_at).
4. If you don’t use the Edge Function yet
Minimum to run in production:

Supabase project + migration applied
Vercel with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, LEADFLOW_HMAC_SECRET
Processing: either deploy Edge + webhook as above, or trigger POST /api/internal/process-raw from a trusted system (cron, queue worker, manual script) with a correct HMAC — the app does not process raw_records on ingest alone.
5. Vercel CLI (optional)
Hooks context noted the CLI might not be installed globally. Useful commands once installed (npm i -g vercel):

vercel link / vercel env pull — sync env for local testing
vercel deploy — manual deploys
Not required if you deploy via Git integration.

Short version: Create Supabase → run the migration → copy URL + service_role into Vercel → set LEADFLOW_HMAC_SECRET on Vercel → deploy → (optional) deploy Supabase Edge function + webhook with matching HMAC and INTERNAL_PROCESS_URL pointing at your live /api/internal/process-raw.

