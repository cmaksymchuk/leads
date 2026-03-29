import type { LeadStatus } from "@/types/leads";
import type { z } from "zod";

/** Row shape from claim_raw_records_for_processing RPC. */
export type RawRecordRow = {
  id: string;
  source: string;
  payload: unknown;
  processing_attempts?: number;
};

/** Fields upserted into public.leads (promotion path). */
export type LeadUpsertPayload = {
  fingerprint: string;
  contact_phone: string;
  address: string;
  city: string;
  postal_code: string;
  region: string;
  payment_shock: number;
  months_to_renewal: number;
  score: number;
  status: Extract<LeadStatus, "available">;
  updated_at: string;
};

export type VerticalQualifyResult =
  | { kind: "skip"; reason: string; region?: string }
  | { kind: "promote"; region: string; rowData: LeadUpsertPayload };

export interface VerticalHandler {
  readonly sources: readonly string[];
  readonly schema: z.ZodTypeAny;
  qualify(row: RawRecordRow): VerticalQualifyResult;
  toLeadShape(parsed: unknown, ctx: unknown): LeadUpsertPayload;
}
