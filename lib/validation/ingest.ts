import { z } from "zod";
import { canadaMortgagePayloadSchema } from "./canada-payload";

export const ingestBodySchema = z.object({
  source: z.string().min(1),
  external_id: z.string().min(1).optional(),
  payload: canadaMortgagePayloadSchema,
});

export type IngestBody = z.infer<typeof ingestBodySchema>;
