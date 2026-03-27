import { getServiceSupabase } from "@/lib/db/server";
import { normalizeLeadData } from "@/lib/normalization/canada-lead";
import { canadaMortgagePayloadSchema } from "@/lib/validation/canada-payload";
import {
  computeLeadScore,
  computeMortgageBalance,
  computePaymentShock,
  fullMonthsFromNowTo,
  parsePurchaseDate,
  renewalDateFromPurchase,
  shouldPromoteLead,
} from "@/lib/processing/mortgage";
import { MAX_RAW_PROCESSING_ATTEMPTS } from "./constants";

const BATCH_LIMIT = 10;

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

type RawRow = {
  id: string;
  source: string;
  payload: unknown;
  processing_attempts?: number;
};

async function finalizeSuccess(supabase: ReturnType<typeof getServiceSupabase>, id: string) {
  const { error } = await supabase
    .from("raw_records")
    .update({
      processed_at: new Date().toISOString(),
      processing_lock: false,
      processing_error: null,
    })
    .eq("id", id);
  if (error) throw error;
}

async function finalizeFailure(
  supabase: ReturnType<typeof getServiceSupabase>,
  row: RawRow,
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
  row: RawRow,
): Promise<{ promoted: boolean; reason?: string }> {
  const phoneRaw =
    typeof row.payload === "object" &&
    row.payload !== null &&
    "contact_phone" in row.payload
      ? String((row.payload as { contact_phone?: unknown }).contact_phone ?? "")
          .trim()
      : "";

  if (!phoneRaw) {
    await finalizeSuccess(supabase, row.id);
    return { promoted: false, reason: "no_phone" };
  }

  const parsed = canadaMortgagePayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    await finalizeSuccess(supabase, row.id);
    return { promoted: false, reason: "invalid_payload" };
  }

  const p = parsed.data;
  const purchaseDate = parsePurchaseDate(p.purchase_date);
  const renewal = renewalDateFromPurchase(purchaseDate);
  const monthsToRenewal = fullMonthsFromNowTo(renewal);
  const mortgageBalance = computeMortgageBalance(p.purchase_price);
  const paymentShock = computePaymentShock(mortgageBalance);
  const score = computeLeadScore(monthsToRenewal, paymentShock);

  const norm = normalizeLeadData({
    address: p.address,
    city: p.city,
    postal_code: p.postal_code,
  });

  if (!shouldPromoteLead(score, monthsToRenewal)) {
    await finalizeSuccess(supabase, row.id);
    return { promoted: false, reason: "below_threshold" };
  }

  const contact_phone = p.contact_phone.trim();
  const { data: existing, error: exErr } = await supabase
    .from("leads")
    .select("id, status")
    .eq("fingerprint", norm.fingerprint)
    .maybeSingle();

  if (exErr) throw exErr;

  if (existing?.status === "sold") {
    await finalizeSuccess(supabase, row.id);
    return { promoted: false, reason: "lead_already_sold" };
  }

  const rowData = {
    fingerprint: norm.fingerprint,
    contact_phone,
    address: norm.normalizedAddress,
    city: norm.normalizedCity,
    postal_code: norm.normalizedPostalCode,
    payment_shock: paymentShock,
    months_to_renewal: monthsToRenewal,
    score,
    status: "available" as const,
    updated_at: new Date().toISOString(),
  };

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
      event_type: "created",
      payload: { raw_record_id: row.id, source: row.source },
      idempotency_key: `promote:${row.id}`,
    });
    if (evErr && !isUniqueViolation(evErr)) throw evErr;
  }

  await finalizeSuccess(supabase, row.id);
  return { promoted: true };
}

export type ProcessBatchResult = {
  claimed: number;
  promoted: number;
  skipped: number;
  errors: Array<{ rawRecordId: string; message: string }>;
};

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

  const rows = (claimed ?? []) as RawRow[];
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
      } catch {
        // best-effort
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
