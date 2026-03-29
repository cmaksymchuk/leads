import { isVerticalId } from "@/lib/capture/constants";
import { z } from "zod";

const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

export const captureChatBodySchema = z
  .object({
    vertical_id: z.string(),
    messages: z.array(chatMessageSchema),
    current_field: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!isVerticalId(data.vertical_id)) {
      ctx.addIssue({
        code: "custom",
        message: "unknown_vertical_id",
        path: ["vertical_id"],
      });
    }
  });

export type CaptureChatBody = z.infer<typeof captureChatBodySchema>;
