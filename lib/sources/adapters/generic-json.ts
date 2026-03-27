import { leadPayloadSchema } from "@/lib/validation/leads";
import type { LeadPayload } from "@/types/leads";
import type { SourceAdapter } from "../types";

/**
 * Accepts either a full `LeadPayload` object or `{ lead: LeadPayload }`.
 * Used for tests and manual ingestion of pre-shaped JSON.
 */
export const genericJsonAdapter: SourceAdapter = {
  sourceType: "generic_json",

  async normalize(raw: unknown): Promise<LeadPayload> {
    const obj =
      typeof raw === "object" &&
      raw !== null &&
      "lead" in raw &&
      typeof (raw as { lead: unknown }).lead === "object"
        ? (raw as { lead: unknown }).lead
        : raw;
    const parsed = leadPayloadSchema.safeParse(obj);
    if (!parsed.success) {
      throw new Error(
        `generic_json: invalid LeadPayload: ${parsed.error.message}`,
      );
    }
    return parsed.data;
  },
};
