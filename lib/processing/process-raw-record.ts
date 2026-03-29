import { logger } from "@/lib/api";
import { getServiceSupabase } from "@/lib/db/server";
import { resolveVerticalHandler } from "@/lib/verticals/registry";
import {
  SKIP_REASON_LEAD_ALREADY_SOLD,
  SKIP_REASON_UNKNOWN_VERTICAL,
} from "@/lib/verticals/skip-reasons";
import type { RawRecordRow } from "@/lib/verticals/types";
import { LEAD_STATUS_SOLD } from "@/types/leads";
import { LEAD_EVENT_TYPE_CREATED, MAX_RAW_PROCESSING_ATTEMPTS } from "./constants";

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

async function finalizeSuccess(
  supabase: ReturnType<typeof getServiceSupabase>,
  id: string,
  opts?: { region?: string; skipReason?: string },
) {
  const patch: Record<string, unknown> = {
    processed_at: new Date().toISOString(),
    processing_lock: false,
    processing_error: null,
    skip_reason: opts?.skipReason ?? null,
  };
  if (opts?.region !== undefined) {
    patch.region = opts.region;
  }
  const { error } = await supabase.from("raw_records").update(patch).eq("id", id);
  if (error) throw error;
}

async function finalizeFailure(
  supabase: ReturnType<typeof getServiceSupabase>,
  row: RawRecordRow,
  message: string,
) {
  const attempts = row.processing_attempts ?? 0;
  const terminal = attempts >= MAX_RAW_PROCESSING_ATTEMPTS;
  const { error } = await supabase
    .from("raw_records")
    .update({
      processing_lock: false,
      processing_error: message,
      processing_attempts: attempts + 1,
      failed_at: terminal ? new Date().toISOString() : null,
    })
    .eq("id", row.id);
  if (error) throw error;
}

async function processOneRow(
  supabase: ReturnType<typeof getServiceSupabase>,
  row: RawRecordRow,
): Promise<{ promoted: boolean; reason?: string }> {
  const handler = resolveVerticalHandler(row.source);
  if (!handler) {
    await finalizeSuccess(supabase, row.id, {
      skipReason: SKIP_REASON_UNKNOWN_VERTICAL,
    });
    return { promoted: false, reason: SKIP_REASON_UNKNOWN_VERTICAL };
  }

  const result = handler.qualify(row);
  if (result.kind === "skip") {
    await finalizeSuccess(supabase, row.id, {
      ...(result.region !== undefined ? { region: result.region } : {}),
      skipReason: result.reason,
    });
    return { promoted: false, reason: result.reason };
  }

  const { region: resolvedRegion, rowData } = result;

  const { data: existing, error: exErr } = await supabase
    .from("leads")
    .select("id, status")
    .eq("fingerprint", rowData.fingerprint)
    .maybeSingle();

  if (exErr) throw exErr;

  if (existing?.status === LEAD_STATUS_SOLD) {
    await finalizeSuccess(supabase, row.id, {
      region: resolvedRegion,
      skipReason: SKIP_REASON_LEAD_ALREADY_SOLD,
    });
    return { promoted: false, reason: SKIP_REASON_LEAD_ALREADY_SOLD };
  }

  let leadId: string;

  if (existing) {
    const { data: updated, error: upErr } = await supabase
      .from("leads")
      .update(rowData)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (upErr) throw upErr;
    leadId = updated!.id;
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from("leads")
      .insert(rowData)
      .select("id")
      .single();
    if (insErr) throw insErr;
    leadId = inserted!.id;

    const { error: evErr } = await supabase.from("lead_events").insert({
      lead_id: leadId,
      event_type: LEAD_EVENT_TYPE_CREATED,
      payload: { raw_record_id: row.id, source: row.source },
      idempotency_key: `promote:${row.id}`,
    });
    if (evErr && !isUniqueViolation(evErr)) throw evErr;
  }

  await finalizeSuccess(supabase, row.id, { region: resolvedRegion });
  return { promoted: true };
}

export type ProcessBatchResult = {
  claimed: number;
  promoted: number;
  skipped: number;
  errors: Array<{ rawRecordId: string; message: string }>;
};

const BATCH_LIMIT = 10;

export async function processRawBatch(
  limit: number = BATCH_LIMIT,
): Promise<ProcessBatchResult> {
  const supabase = getServiceSupabase();
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_raw_records_for_processing",
    { p_limit: limit },
  );

  if (claimErr) {
    throw new Error(claimErr.message);
  }

  const rows = (claimed ?? []) as RawRecordRow[];
  let promoted = 0;
  let skipped = 0;
  const errors: ProcessBatchResult["errors"] = [];

  for (const row of rows) {
    try {
      const r = await processOneRow(supabase, row);
      if (r.promoted) promoted += 1;
      else skipped += 1;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      errors.push({ rawRecordId: row.id, message });
      try {
        await finalizeFailure(supabase, row, message);
      } catch (e) {
        logger.error(
          JSON.stringify({
            event: "finalize_skip_reason_failed",
            rowId: row.id,
            error: String(e),
          }),
        );
      }
    }
  }

  return {
    claimed: rows.length,
    promoted,
    skipped,
    errors,
  };
}
