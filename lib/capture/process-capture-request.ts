import { z } from "zod";
import type { ZodIssue } from "zod";
import {
  buildCaptureSource,
  CAPTURE_ERROR_UNKNOWN_VERTICAL_ID,
  CAPTURE_ERROR_VALIDATION,
  CAPTURE_RESPONSE_INTERNAL_ERROR,
  isVerticalId,
  RAW_RECORD_STATUS_PENDING,
  type VerticalId,
} from "@/lib/capture/constants";
import { captureRequestSchema } from "@/lib/capture/schemas";
import { logger } from "@/lib/api";

export const CAPTURE_FIELD_MSG_UNSUPPORTED_VERTICAL =
  "Unsupported vertical_id" as const;

export type CaptureIngestSuccess = {
  ok: true;
  recordId: string;
  verticalId: VerticalId;
  consentGiven: boolean;
  region: string | null;
};

export type CaptureIngestFailure =
  | {
      ok: false;
      status: 400;
      error: string;
      fields?: Record<string, string>;
    }
  | { ok: false; status: 500; error: typeof CAPTURE_RESPONSE_INTERNAL_ERROR };

export type CaptureIngestResult = CaptureIngestSuccess | CaptureIngestFailure;

type InsertSingleResult = {
  data: { id: string } | null;
  error: { message: string; code?: string } | null;
};

/** Narrow surface for tests; real Supabase client is structurally compatible via PromiseLike. */
export type RawRecordsInsertClient = {
  from: (table: "raw_records") => {
    insert: (row: {
      source: string;
      payload: unknown;
      region: string | null;
      status: typeof RAW_RECORD_STATUS_PENDING;
    }) => {
      select: (columns: string) => {
        single: () => PromiseLike<InsertSingleResult>;
      };
    };
  };
};

function zodIssuesToFields(issues: ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const path = issue.path.length ? issue.path.map(String).join(".") : "_root";
    out[path] = issue.message;
  }
  return out;
}

/**
 * Validates capture JSON and inserts raw_records. Supabase errors are returned as 500 candidates;
 * callers log and map to HTTP.
 */
export async function processCaptureIngest(
  body: unknown,
  deps: {
    supabase: RawRecordsInsertClient;
    resolveCaptureRegion: (postalCode: string) => string | null;
    requestId: string;
  },
): Promise<CaptureIngestResult> {
  const peek = z
    .object({ vertical_id: z.string() })
    .safeParse(body);

  if (!peek.success) {
    return {
      ok: false,
      status: 400,
      error: CAPTURE_ERROR_VALIDATION,
      fields: zodIssuesToFields(peek.error.issues),
    };
  }

  if (!isVerticalId(peek.data.vertical_id)) {
    return {
      ok: false,
      status: 400,
      error: CAPTURE_ERROR_UNKNOWN_VERTICAL_ID,
      fields: { vertical_id: CAPTURE_FIELD_MSG_UNSUPPORTED_VERTICAL },
    };
  }

  const parsed = captureRequestSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      error: CAPTURE_ERROR_VALIDATION,
      fields: zodIssuesToFields(parsed.error.issues),
    };
  }

  const data = parsed.data;
  const source = buildCaptureSource(data.vertical_id);
  const region = deps.resolveCaptureRegion(data.intent.postal_code);

  logger.info("capture_request_validated", {
    flow: "lead-capture",
    requestId: deps.requestId,
    vertical_id: data.vertical_id,
    consent_given: data.consent.given,
    resolved_region: region,
  });

  const { data: inserted, error } = await deps.supabase
    .from("raw_records")
    .insert({
      source,
      payload: data,
      region,
      status: RAW_RECORD_STATUS_PENDING,
    })
    .select("id")
    .single();

  if (error) {
    logger.error("capture_supabase_insert_failed", {
      flow: "lead-capture",
      requestId: deps.requestId,
      vertical_id: data.vertical_id,
      consent_given: data.consent.given,
      resolved_region: region,
      supabase_message: error.message,
      supabase_code: error.code,
    });
    return { ok: false, status: 500, error: CAPTURE_RESPONSE_INTERNAL_ERROR };
  }

  if (!inserted?.id) {
    logger.error("capture_supabase_insert_empty", {
      flow: "lead-capture",
      requestId: deps.requestId,
      vertical_id: data.vertical_id,
    });
    return { ok: false, status: 500, error: CAPTURE_RESPONSE_INTERNAL_ERROR };
  }

  logger.info("capture_raw_record_inserted", {
    flow: "lead-capture",
    requestId: deps.requestId,
    vertical_id: data.vertical_id,
    consent_given: data.consent.given,
    resolved_region: region,
    record_id: inserted.id,
  });

  return {
    ok: true,
    recordId: inserted.id,
    verticalId: data.vertical_id,
    consentGiven: data.consent.given,
    region,
  };
}
