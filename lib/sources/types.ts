import type { LeadPayload } from "@/types/leads";

export interface SourceAdapter {
  readonly sourceType: string;
  normalize(raw: unknown): Promise<LeadPayload>;
}
