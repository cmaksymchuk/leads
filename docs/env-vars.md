# Environment Variables

| Variable | Required | Environments | Purpose |
|---|---|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Yes | All | Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Yes | Server only | Supabase admin access |
| LEADFLOW_HMAC_SECRET | Yes | All | Signs /api/process-raw requests |
| LEADFLOW_WEBHOOK_URL | No | Prod | Outbound webhook for lead routing |
| LEADFLOW_DRY_RUN | No | All | Skip outbound HTTP if true |
| LEADFLOW_COMPLIANCE_FOOTER | No | All | Appended to outreach previews |
| LEADFLOW_API_URL | No | Local | Target for Python ingest scripts (e.g. `python/mb_roll_entry/ingest_mb_roll_entry.py --send` → `http://localhost:3000/api/ingest`). Not used by the Next.js app. |
| SENTRY_DSN | No | Server only | Error reporting (`lib/observability.ts`); omit locally if unused. Test: `npm run test:sentry` (requires DSN in `.env.local`). |
