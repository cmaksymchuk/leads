import type { LeadDestination } from "./types";

export interface DeliveryOptions {
  /** When true, never perform outbound HTTP (dry run / preview). */
  dryRun?: boolean;
}

/**
 * Executes routing destinations. Kept separate from `route()` for monetization
 * and observability (retry, signing, audit events).
 */
export async function deliverDestinations(
  leadId: string,
  destinations: LeadDestination[],
  options: DeliveryOptions = {},
): Promise<void> {
  if (options.dryRun) return;

  for (const d of destinations) {
    if (d.type === "webhook") {
      const url = d.config.url;
      if (typeof url !== "string" || !url) continue;
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "lead.routed",
          leadId,
          destination: d,
        }),
      });
    }
  }
}
