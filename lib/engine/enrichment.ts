import type { LeadPayload } from "@/types/leads";

export interface EnrichmentProvider {
  canHandle(lead: LeadPayload): boolean;
  enrich(lead: LeadPayload): Promise<Partial<LeadPayload>>;
}
