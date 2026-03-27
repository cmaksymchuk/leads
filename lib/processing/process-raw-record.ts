import { deliverDestinations } from "@/lib/engine/delivery";
import { WorkflowManager } from "@/lib/engine/workflow-manager";
import { getServiceSupabase } from "@/lib/db/server";
import { computeDedupeKey, computeFingerprint } from "@/lib/dedupe/fingerprint";
import { getSourceAdapter } from "@/lib/sources/registry";
import { mergeMetadata } from "@/lib/utils/merge";
import type {
  BusinessLead,
  LeadPayload,
  RealEstateLead,
} from "@/types/leads";
import { MAX_RAW_PROCESSING_ATTEMPTS } from "./constants";

const workflow = new WorkflowManager([]);

function withMergedMetadata(
  lead: LeadPayload,
  mergedMeta: Record<string, unknown>,
): LeadPayload {
  if (lead.lead_type === "real_estate") {
    return {
      ...lead,
      metadata: mergedMeta as RealEstateLead["metadata"],
    };
  }
  return {
    ...lead,
    metadata: mergedMeta as BusinessLead["metadata"],
  };
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "23505"
  );
}

export type ProcessResult =
  | { status: "ok"; leadId: string; rawRecordId: string }
  | { status: "skipped"; reason: string; rawRecordId: string }
  | { status: "error"; message: string; rawRecordId: string };

export async function processRawRecord(rawRecordId: string): Promise<ProcessResult> {
  const supabase = getServiceSupabase();

  const { data: lockedRows, error: lockErr } = await supabase.rpc(
    "acquire_raw_record_lock",
    { p_id: rawRecordId },
  );

  if (lockErr) {
    return {
      status: "error",
      message: lockErr.message,
      rawRecordId,
    };
  }

  const locked = Array.isArray(lockedRows) ? lockedRows[0] : lockedRows;
  if (!locked) {
    const { data: row } = await supabase
      .from("raw_records")
      .select("*")
      .eq("id", rawRecordId)
      .maybeSingle();

    if (!row) {
      return { status: "error", message: "raw_record not found", rawRecordId };
    }
    if (row.processed_at) {
      return { status: "skipped", reason: "already_processed", rawRecordId };
    }
    if (row.failed_at) {
      return { status: "skipped", reason: "dead_letter", rawRecordId };
    }
    return { status: "skipped", reason: "lock_not_acquired", rawRecordId };
  }

  const raw = locked as {
    id: string;
    source_type: string;
    payload: unknown;
    processing_attempts: number;
  };

  try {
    const adapter = getSourceAdapter(raw.source_type);
    let lead: LeadPayload = await adapter.normalize(raw.payload);
    const fingerprint = computeFingerprint(lead);
    const dedupeKey = computeDedupeKey(lead);

    const { data: fpRow } = await supabase
      .from("leads")
      .select("id, metadata")
      .eq("fingerprint", fingerprint)
      .maybeSingle();

    let existingId: string | null = fpRow?.id ?? null;

    if (!existingId) {
      const { data: fuzzyRows, error: fuzzyErr } = await supabase.rpc(
        "match_leads_fuzzy",
        {
          p_region: lead.region,
          p_company: lead.company_name,
          p_threshold: 0.35,
        },
      );
      if (!fuzzyErr && fuzzyRows && Array.isArray(fuzzyRows) && fuzzyRows.length > 0) {
        existingId = (fuzzyRows[0] as { id: string }).id;
      }
    }

    const { data: suppressed } = lead.contact_email
      ? await supabase
          .from("suppression_list")
          .select("id")
          .eq("email", lead.contact_email.toLowerCase())
          .maybeSingle()
      : { data: null };

    const initialStatus = suppressed ? "suppressed" : "new";

    let leadId: string;

    if (existingId) {
      const { data: existing } = await supabase
        .from("leads")
        .select("metadata, status")
        .eq("id", existingId)
        .single();

      const mergedMeta = mergeMetadata(
        (existing?.metadata as Record<string, unknown>) ?? {},
        lead.metadata as unknown as Record<string, unknown>,
      );

      const { data: updated, error: upErr } = await supabase
        .from("leads")
        .update({
          metadata: mergedMeta,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          dedupe_key: dedupeKey,
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          company_name: lead.company_name,
          city: lead.city,
          region: lead.region,
          source_url: lead.source_url || "",
        })
        .eq("id", existingId)
        .select("id")
        .single();

      if (upErr) throw upErr;
      leadId = updated!.id;
      lead = withMergedMetadata(lead, mergedMeta);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("leads")
        .insert({
          lead_type: lead.lead_type,
          status: initialStatus,
          fingerprint,
          fingerprint_version: 1,
          company_name: lead.company_name,
          contact_name: lead.contact_name,
          contact_email: lead.contact_email,
          city: lead.city,
          region: lead.region,
          source_url: lead.source_url || "",
          metadata: lead.metadata,
          dedupe_key: dedupeKey,
          consent_basis: lead.consent_basis ?? null,
          consent_expiry: lead.consent_expiry ?? null,
          last_seen_at: new Date().toISOString(),
          first_seen_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (insErr) {
        if (isUniqueViolation(insErr)) {
          const { data: again } = await supabase
            .from("leads")
            .select("id, metadata")
            .eq("fingerprint", fingerprint)
            .maybeSingle();
          if (!again?.id) throw insErr;
          const mergedRace = mergeMetadata(
            (again.metadata as Record<string, unknown>) ?? {},
            lead.metadata as unknown as Record<string, unknown>,
          );
          const { data: updatedRace, error: raceErr } = await supabase
            .from("leads")
            .update({
              metadata: mergedRace,
              last_seen_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              dedupe_key: dedupeKey,
              contact_name: lead.contact_name,
              contact_email: lead.contact_email,
              company_name: lead.company_name,
              city: lead.city,
              region: lead.region,
              source_url: lead.source_url || "",
            })
            .eq("id", again.id)
            .select("id")
            .single();
          if (raceErr) throw raceErr;
          leadId = updatedRace!.id;
          lead = withMergedMetadata(lead, mergedRace);
        } else {
          throw insErr;
        }
      } else {
        leadId = inserted!.id;
      }
    }

    const wf = await workflow.processLead(lead);

    await supabase
      .from("leads")
      .update({
        metadata: wf.lead.metadata as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq("id", leadId);

    const { error: evErr } = await supabase.from("lead_events").insert({
      lead_id: leadId,
      event_type: "raw_record.processed",
      payload: {
        raw_record_id: rawRecordId,
        source_type: raw.source_type,
      },
      idempotency_key: `raw:${rawRecordId}`,
    });
    if (evErr && !isUniqueViolation(evErr)) throw evErr;

    const { error: scErr } = await supabase.from("lead_scores").insert({
      lead_id: leadId,
      score: wf.score.score,
      reasoning: wf.score.reasoning,
      idempotency_key: `score:${rawRecordId}`,
    });
    if (scErr && !isUniqueViolation(scErr)) throw scErr;

    const dryRun = process.env.LEADFLOW_DRY_RUN === "true";
    await deliverDestinations(leadId, wf.destinations, { dryRun });

    const { error: doneErr } = await supabase
      .from("raw_records")
      .update({
        processed_at: new Date().toISOString(),
        processing_lock: false,
        processing_error: null,
      })
      .eq("id", rawRecordId);

    if (doneErr) throw doneErr;

    return { status: "ok", leadId, rawRecordId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const attempts = raw.processing_attempts;
    const terminal = attempts >= MAX_RAW_PROCESSING_ATTEMPTS;

    await supabase
      .from("raw_records")
      .update({
        processing_lock: false,
        processing_error: message,
        failed_at: terminal ? new Date().toISOString() : null,
      })
      .eq("id", rawRecordId);

    return { status: "error", message, rawRecordId };
  }
}
