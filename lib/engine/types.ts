export type LeadDestination =
  | { type: "webhook"; config: Record<string, unknown> }
  | { type: "crm"; config: Record<string, unknown> }
  | { type: "internal"; config: Record<string, unknown> };
