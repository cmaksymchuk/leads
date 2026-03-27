# LeadFlow Canada: Supabase Database Webhook → Edge Function → Next.js

1. Apply migrations in `supabase/migrations/` (init + Canada MVP migration).
2. Deploy the Edge Function in `supabase/functions/process-raw` (`supabase functions deploy process-raw`).
3. Set Edge secrets:
   - `LEADFLOW_HMAC_SECRET` — shared with the Next.js app (`LEADFLOW_HMAC_SECRET`).
   - `INTERNAL_PROCESS_URL` — `https://<your-domain>/api/process-raw`.
4. In Supabase Dashboard → **Database** → **Webhooks**, create a webhook on `public.raw_records` **INSERT** targeting the Edge Function URL (or HTTP URL that invokes the function per Supabase docs).
5. Ensure the Next.js deployment has:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `LEADFLOW_HMAC_SECRET` (same value as Edge)

The Edge Function POSTs a JSON body (e.g. `{ "webhookDeliveryId": "<uuid>" }`) with `X-LeadFlow-Timestamp` and `X-LeadFlow-Signature` (`v1=<hex>`) where the hex is `HMAC-SHA256(secret, \`${timestamp}.${body}\`)`. Next.js claims a batch of unprocessed `raw_records` and processes them.
