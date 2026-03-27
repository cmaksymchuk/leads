import { createHash } from "node:crypto";
import type { LeadPayload } from "@/types/leads";
import { buildFingerprintObject, stableStringify } from "./canonicalize";

export function computeFingerprint(lead: LeadPayload): string {
  const canonical = buildFingerprintObject(lead);
  const keys = Object.keys(canonical).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = canonical[k];
  const payload = stableStringify(sorted as Record<string, unknown>);
  return createHash("sha256").update(payload, "utf8").digest("hex");
}

/** Secondary bucket for fuzzy matching (same region + similar company). */
export function computeDedupeKey(lead: LeadPayload): string {
  const c = buildFingerprintObject(lead) as {
    company_name: string;
    region: string;
    lead_type: string;
  };
  const s = `${c.lead_type}|${c.company_name}|${c.region}`;
  return createHash("sha256").update(s, "utf8").digest("hex");
}
