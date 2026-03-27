import { verifyHmacSignature } from "@/lib/auth/hmac";
import {
  apiErrorJson,
  apiJson,
  logger,
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import { HMAC_MAX_SKEW_SECONDS } from "@/lib/processing/constants";
import { processRawBatch } from "@/lib/processing/process-raw-record";
import { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  const { requestId } = ctx;

  const secret = process.env.LEADFLOW_HMAC_SECRET;
  if (!secret) {
    logger.error("process_raw_misconfigured", {
      route: "/api/process-raw",
      flow: "processing",
      requestId,
      detail: "LEADFLOW_HMAC_SECRET",
    });
    return apiErrorJson(
      { error: "server_misconfigured", detail: "LEADFLOW_HMAC_SECRET" },
      500,
      requestId,
    );
  }

  const bodyText = await req.text();
  const ts = req.headers.get("x-leadflow-timestamp");
  const sig = req.headers.get("x-leadflow-signature");

  if (!ts || !sig) {
    return apiErrorJson({ error: "unauthorized" }, 401, requestId);
  }

  const verified = verifyHmacSignature({
    secret,
    timestamp: ts,
    body: bodyText,
    signatureHeader: sig,
    maxSkewSeconds: HMAC_MAX_SKEW_SECONDS,
  });

  if (!verified.ok) {
    return apiErrorJson({ error: verified.reason }, 401, requestId);
  }

  let parsed: unknown = {};
  if (bodyText.length > 0) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return apiErrorJson({ error: "invalid_json" }, 400, requestId);
    }
  }

  const body = bodySchema.safeParse(parsed);
  if (!body.success) {
    return apiErrorJson(
      { error: "validation_error", details: body.error.flatten() },
      400,
      requestId,
    );
  }

  const batchLimit = body.data.limit ?? 10;

  try {
    const result = await processRawBatch(batchLimit);
    if (result.claimed > 0 || result.errors.length > 0) {
      logger.info("process_raw_batch_complete", {
        route: "/api/process-raw",
        flow: "processing",
        requestId,
        claimed: result.claimed,
        promoted: result.promoted,
        skipped: result.skipped,
        errorCount: result.errors.length,
      });
    }
    return apiJson(
      {
        claimed: result.claimed,
        promoted: result.promoted,
        skipped: result.skipped,
        errors: result.errors,
      },
      200,
      requestId,
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("process_raw_batch_failed", {
      route: "/api/process-raw",
      flow: "processing",
      requestId,
      batchSizeAttempted: batchLimit,
      error: message,
    });
    return apiErrorJson({ error: "process_failed", message }, 500, requestId);
  }
}

export const POST = withMonitoring(handlePost, {
  route: "/api/process-raw",
  flow: "processing",
});
