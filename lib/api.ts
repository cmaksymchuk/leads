import { captureException, captureLogError } from "@/lib/observability";
import { NextRequest, NextResponse } from "next/server";

export type FlowTag =
  | "lead-capture"
  | "processing"
  | "qualification"
  | "handoff"
  | "admin"
  | "preview";

export type MonitoringContext = {
  requestId: string;
};

type MonitoringOptions = {
  route: string;
  flow: FlowTag;
};

type LoggerErrorOptions = {
  /** Set false when also calling captureException() for the same event. Default true. */
  sentry?: boolean;
};

/**
 * JSON success response with x-request-id header (no requestId in body).
 */
export function apiJson(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
): NextResponse {
  const res = NextResponse.json(body, { status });
  res.headers.set("x-request-id", requestId);
  return res;
}

/**
 * JSON error response with requestId in body and x-request-id header.
 */
export function apiErrorJson(
  body: Record<string, unknown>,
  status: number,
  requestId: string,
): NextResponse {
  const res = NextResponse.json({ ...body, requestId }, { status });
  res.headers.set("x-request-id", requestId);
  return res;
}

/**
 * Structured logger. Use this instead of console.log/error directly.
 * When SENTRY_DSN is set, error-level logs are forwarded to Sentry (unless sentry: false).
 */
export const logger = {
  info: (message: string, context?: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        level: "info",
        message,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
  },
  warn: (message: string, context?: Record<string, unknown>) => {
    console.warn(
      JSON.stringify({
        level: "warn",
        message,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
  },
  error: (
    message: string,
    context?: Record<string, unknown>,
    options?: LoggerErrorOptions,
  ) => {
    console.error(
      JSON.stringify({
        level: "error",
        message,
        ...context,
        timestamp: new Date().toISOString(),
      }),
    );
    if (options?.sentry !== false) {
      captureLogError(message, context);
    }
  },
};

/**
 * Wraps an API route handler with structured error handling and observability.
 * Every route in app/api/ must use this wrapper.
 */
export function withMonitoring(
  handler: (req: NextRequest, ctx: MonitoringContext) => Promise<NextResponse>,
  options: MonitoringOptions,
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

    try {
      const response = await handler(req, { requestId });
      if (!response.headers.get("x-request-id")) {
        response.headers.set("x-request-id", requestId);
      }
      return response;
    } catch (error) {
      logger.error(
        "api_handler_threw",
        {
          route: options.route,
          flow: options.flow,
          requestId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        { sentry: false },
      );
      captureException(error, {
        route: options.route,
        flow: options.flow,
        requestId,
      });

      const res = NextResponse.json(
        { error: "Internal server error", requestId },
        { status: 500 },
      );
      res.headers.set("x-request-id", requestId);
      return res;
    }
  };
}
