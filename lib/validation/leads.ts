import { z } from "zod";
import { LEAD_TYPES, LEAD_STATUSES } from "@/types/leads";

const consentBasisSchema = z.enum([
  "explicit_opt_in",
  "legitimate_interest",
  "contract",
  "unknown",
]);

const realEstateMetadataSchema = z
  .object({
    signal_type: z.enum(["listing", "expired", "price_drop", "other"]),
    property_value: z.number().optional(),
    timeline_stage: z.string().optional(),
  })
  .passthrough();

const businessMetadataSchema = z
  .object({
    signal_type: z.enum(["expansion", "hiring", "funding", "other"]),
    estimated_value: z.number().optional(),
  })
  .passthrough();

const emailIn = z.preprocess(
  (v) => (v === "" || v === undefined ? null : v),
  z.string().email().nullable(),
);

const sourceUrlIn = z.union([
  z.string().url(),
  z.literal(""),
]);

const baseFields = {
  company_name: z.string().min(1),
  contact_name: z.string(),
  contact_email: emailIn,
  city: z.string(),
  region: z.string(),
  source_url: sourceUrlIn,
  consent_basis: consentBasisSchema.nullish(),
  consent_expiry: z.string().datetime().nullish(),
};

export const realEstateLeadSchema = z.object({
  ...baseFields,
  lead_type: z.literal("real_estate"),
  metadata: realEstateMetadataSchema,
});

export const businessLeadSchema = z.object({
  ...baseFields,
  lead_type: z.literal("business"),
  metadata: businessMetadataSchema,
});

export const leadPayloadSchema = z.discriminatedUnion("lead_type", [
  realEstateLeadSchema,
  businessLeadSchema,
]);

export const leadTypeSchema = z.enum(LEAD_TYPES);
export const leadStatusSchema = z.enum(LEAD_STATUSES);

/** Normalize empty string email to null */
export function normalizeLeadPayloadEmail<T extends { contact_email: string | null }>(
  lead: T,
): T {
  if (lead.contact_email === "") {
    return { ...lead, contact_email: null };
  }
  return lead;
}
