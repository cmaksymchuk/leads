import type { LeadPayload } from "@/types/leads";

export function normalizeField(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}@.\s+-]/gu, "")
    .toLowerCase();
}

/** Discriminator only: stable, do not strip underscores (e.g. real_estate). */
export function normalizeLeadType(s: string): string {
  return s.trim().toLowerCase();
}

function normalizeEmail(email: string | null): string {
  if (!email) return "";
  const e = email.trim().toLowerCase();
  const at = e.indexOf("@");
  if (at === -1) return normalizeField(e);
  const local = e.slice(0, at);
  const domain = e.slice(at + 1);
  return `${local}@${domain}`;
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    u.hash = "";
    u.hostname = u.hostname.toLowerCase();
    return u.toString();
  } catch {
    return normalizeField(url);
  }
}

/** Only allowlisted metadata keys participate in fingerprint (per lead_type). */
function fingerprintMetadataSlice(lead: LeadPayload): Record<string, string | number> {
  const m = lead.metadata as Record<string, unknown>;
  const out: Record<string, string | number> = {};

  const take = (keys: string[]) => {
    for (const k of keys) {
      const v = m[k];
      if (v === undefined || v === null) continue;
      if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
      if (typeof v === "string") out[k] = normalizeField(v);
    }
  };

  if (lead.lead_type === "real_estate") {
    take(["signal_type", "listing_id", "property_id"]);
  } else {
    take(["signal_type", "company_id"]);
  }

  return out;
}

/**
 * Stable object for JSON.stringify: sorted keys, only allowlisted fields.
 */
export function buildFingerprintObject(lead: LeadPayload): Record<string, unknown> {
  const meta = fingerprintMetadataSlice(lead);
  const metaKeys = Object.keys(meta).sort();
  const sortedMeta: Record<string, unknown> = {};
  for (const k of metaKeys) sortedMeta[k] = meta[k];

  return {
    lead_type: normalizeLeadType(lead.lead_type),
    company_name: normalizeField(lead.company_name),
    contact_email: normalizeEmail(lead.contact_email),
    city: normalizeField(lead.city),
    region: normalizeField(lead.region),
    source_url: normalizeUrl(lead.source_url),
    metadata: sortedMeta,
  };
}

export function stableStringify(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}
