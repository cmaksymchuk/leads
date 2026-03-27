import { z } from "zod";

export const ingestBodySchema = z.object({
  source_type: z.string().min(1),
  external_id: z.string().min(1).optional(),
  payload: z.unknown(),
});

export type IngestBody = z.infer<typeof ingestBodySchema>;
