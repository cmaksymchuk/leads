import {
  apiErrorJson,
  apiJson,
  logger,
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import { getServiceSupabase } from "@/lib/db/server";
import { resolveRegion } from "@/lib/normalization/canada-lead";
import { ingestBodySchema } from "@/lib/validation/ingest";
import { NextRequest } from "next/server";

async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  const { requestId } = ctx;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiErrorJson({ error: "invalid_json" }, 400, requestId);
  }

  const parsed = ingestBodySchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorJson(
      { error: "validation_error", details: parsed.error.flatten() },
      400,
      requestId,
    );
  }

  const { source, external_id, payload } = parsed.data;

  const region = resolveRegion({
    postal_code: payload.postal_code,
    region: payload.region,
  });

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("raw_records")
      .insert({
        source: source,
        external_id: external_id ?? null,
        payload: payload as object,
        region,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return apiErrorJson(
          { error: "duplicate_external_id", code: error.code },
          409,
          requestId,
        );
      }
      logger.error("ingest_supabase_error", {
        route: "/api/ingest",
        flow: "lead-capture",
        requestId,
        code: error.code,
      });
      return apiErrorJson({ error: error.message }, 500, requestId);
    }

    return apiJson({ id: data.id, ingested: true }, 200, requestId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("ingest_failed", {
      route: "/api/ingest",
      flow: "lead-capture",
      requestId,
      error: message,
    });
    return apiErrorJson({ error: message }, 500, requestId);
  }
}

export const POST = withMonitoring(handlePost, {
  route: "/api/ingest",
  flow: "lead-capture",
});
