/**
 * Polymorphic lead model: coarse `lead_type` discriminant; industry signal lives in `metadata`.
 */

export const LEAD_TYPES = ["real_estate", "business"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const LEAD_STATUSES = [
  "new",
  "qualified",
  "routed",
  "suppressed",
  "failed",
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export type ConsentBasis =
  | "explicit_opt_in"
  | "legitimate_interest"
  | "contract"
  | "unknown";

export interface RealEstateSignalMetadata {
  signal_type:
    | "listing"
    | "expired"
    | "price_drop"
    | "other";
  property_value?: number;
  timeline_stage?: string;
  [key: string]: unknown;
}

export interface BusinessSignalMetadata {
  signal_type:
    | "expansion"
    | "hiring"
    | "funding"
    | "other";
  estimated_value?: number;
  [key: string]: unknown;
}

export interface BaseLeadFields {
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  city: string;
  region: string;
  source_url: string;
  consent_basis?: ConsentBasis | null;
  consent_expiry?: string | null;
}

export interface RealEstateLead extends BaseLeadFields {
  lead_type: "real_estate";
  metadata: RealEstateSignalMetadata;
}

export interface BusinessLead extends BaseLeadFields {
  lead_type: "business";
  metadata: BusinessSignalMetadata;
}

export type LeadPayload = RealEstateLead | BusinessLead;

/** DB row shape + identity fields used by the engine (not raw ingest). */
export interface LeadRecord {
  id: string;
  created_at: string;
  updated_at: string;
  lead_type: string;
  status: LeadStatus;
  fingerprint: string;
  fingerprint_version: number;
  company_name: string;
  contact_name: string;
  contact_email: string | null;
  city: string;
  region: string;
  source_url: string;
  metadata: Record<string, unknown>;
  last_seen_at: string;
  first_seen_at: string;
  dedupe_key: string | null;
  consent_basis: string | null;
  consent_expiry: string | null;
}

export function isRealEstateLead(
  lead: LeadPayload,
): lead is RealEstateLead {
  return lead.lead_type === "real_estate";
}

export function isBusinessLead(lead: LeadPayload): lead is BusinessLead {
  return lead.lead_type === "business";
}
