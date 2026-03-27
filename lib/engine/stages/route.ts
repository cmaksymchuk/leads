import type { LeadPayload } from "@/types/leads";
import type { LeadDestination } from "../types";

/** Planning only: where to deliver. Execution is `lib/engine/delivery`. */
export function routeLead(lead: LeadPayload): LeadDestination[] {
  void lead;
  const webhookUrl = process.env.LEADFLOW_WEBHOOK_URL;
  if (webhookUrl && webhookUrl.length > 0) {
    return [{ type: "webhook", config: { url: webhookUrl } }];
  }
  return [
    {
      type: "internal",
      config: { sink: "default", note: "No LEADFLOW_WEBHOOK_URL configured" },
    },
  ];
}
