import * as Sentry from "@sentry/node";

let sentryInitialized = false;

function ensureSentry(): void {
  if (sentryInitialized || !process.env.SENTRY_DSN) return;
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 0,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  });
  sentryInitialized = true;
}

/** Use for thrown errors so Sentry gets stack traces and grouping. */
export function captureException(
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN) return;
  ensureSentry();
  Sentry.captureException(error, { extra: context });
}

/** Use for structured failures that are not Error instances. */
export function captureLogError(
  message: string,
  context?: Record<string, unknown>,
): void {
  if (!process.env.SENTRY_DSN) return;
  ensureSentry();
  Sentry.captureMessage(message, { level: "error", extra: context });
}
