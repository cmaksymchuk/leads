import type { LeadPayload } from "@/types/leads";

export interface ScoreResult {
  score: number;
  reasoning: Record<string, unknown>;
}

/** Deterministic heuristic scoring (no network). Replace with ML/rules later. */
export function scoreLead(lead: LeadPayload): ScoreResult {
  let score = 50;
  const reasoning: Record<string, unknown> = { model: "heuristic_v1" };

  if (lead.lead_type === "real_estate") {
    reasoning.lead_type = "real_estate";
    const pv = lead.metadata.property_value;
    if (typeof pv === "number" && pv > 0) {
      const bump = Math.min(25, Math.log10(pv + 1) * 2);
      score += bump;
      reasoning.property_value = pv;
    }
  } else {
    reasoning.lead_type = "business";
    const ev = lead.metadata.estimated_value;
    if (typeof ev === "number" && ev > 0) {
      const bump = Math.min(25, Math.log10(ev + 1) * 2);
      score += bump;
      reasoning.estimated_value = ev;
    }
  }

  score = Math.min(100, Math.round(score));
  return { score, reasoning };
}
