import { mergeMetadata } from "@/lib/utils/merge";
import type { BusinessLead, LeadPayload, RealEstateLead } from "@/types/leads";

export function mergeLeadPayload(
  base: LeadPayload,
  partial: Partial<LeadPayload>,
): LeadPayload {
  if (!partial || Object.keys(partial).length === 0) return base;

  if (partial.metadata && base.metadata) {
    if (base.lead_type === "real_estate") {
      const b = base as RealEstateLead;
      const rest = { ...(partial as Partial<RealEstateLead>) };
      delete rest.metadata;
      delete rest.lead_type;
      const merged: RealEstateLead = {
        ...b,
        ...rest,
        lead_type: "real_estate",
        metadata: mergeMetadata(
          b.metadata as unknown as Record<string, unknown>,
          (partial.metadata ?? {}) as Record<string, unknown>,
        ) as RealEstateLead["metadata"],
      };
      return merged;
    }
    const b = base as BusinessLead;
    const rest = { ...(partial as Partial<BusinessLead>) };
    delete rest.metadata;
    delete rest.lead_type;
    const merged: BusinessLead = {
      ...b,
      ...rest,
      lead_type: "business",
      metadata: mergeMetadata(
        b.metadata as unknown as Record<string, unknown>,
        (partial.metadata ?? {}) as Record<string, unknown>,
      ) as BusinessLead["metadata"],
    };
    return merged;
  }

  return { ...base, ...partial } as LeadPayload;
}
