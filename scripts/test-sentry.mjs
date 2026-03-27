/**
 * Sends a one-off test error to Sentry (same SDK as production).
 *
 * Usage:
 *   npm run test:sentry
 * (loads SENTRY_DSN from .env.local via Node --env-file)
 *
 * Or inline:
 *   SENTRY_DSN="https://...@...ingest.sentry.io/..." node scripts/test-sentry.mjs
 */
import * as Sentry from "@sentry/node";

const dsn = process.env.SENTRY_DSN;
if (!dsn) {
  console.error(
    "Missing SENTRY_DSN. Add it to .env.local or pass: SENTRY_DSN=... node scripts/test-sentry.mjs",
  );
  process.exit(1);
}

Sentry.init({
  dsn,
  tracesSampleRate: 0,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
});

Sentry.captureException(
  new Error("LeadFlow Sentry connectivity test (scripts/test-sentry.mjs)"),
);

await Sentry.flush(2000);
console.log("Sent. Open Sentry → Issues (may take a few seconds).");
