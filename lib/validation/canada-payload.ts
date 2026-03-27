import { z } from "zod";

/** Payload stored in raw_records.payload for Canada mortgage MVP. */
export const canadaMortgagePayloadSchema = z.object({
  purchase_price: z.number().positive(),
  purchase_date: z.string().min(1),
  contact_phone: z.string().min(1),
  address: z.string().min(1),
  city: z.string().min(1),
  postal_code: z.string().min(1),
  /** Optional 2-letter province/territory override (e.g. ON, BC). */
  region: z.string().length(2).optional(),
});

export type CanadaMortgagePayload = z.infer<typeof canadaMortgagePayloadSchema>;
