import { mergeLeadPayload } from "@/lib/processing/merge-lead";
import type { LeadPayload } from "@/types/leads";
import type { EnrichmentProvider } from "./enrichment";
import { scoreLead } from "./stages/score";
import { routeLead } from "./stages/route";
import type { LeadDestination } from "./types";

export interface WorkflowResult {
  lead: LeadPayload;
  score: ReturnType<typeof scoreLead>;
  destinations: LeadDestination[];
}

/**
 * Composable pipeline: enrichment → score → route (destinations only).
 * Persistence of scores/events remains in `process-raw-record` for idempotency.
 */
export class WorkflowManager {
  constructor(private readonly providers: EnrichmentProvider[] = []) {}

  async processLead(lead: LeadPayload): Promise<WorkflowResult> {
    let current = lead;
    for (const p of this.providers) {
      if (p.canHandle(current)) {
        const partial = await p.enrich(current);
        current = mergeLeadPayload(current, partial);
      }
    }
    const score = scoreLead(current);
    const destinations = routeLead(current);
    return { lead: current, score, destinations };
  }
}
