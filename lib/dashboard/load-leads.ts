import { getServiceSupabase } from "@/lib/db/server";

export interface LeadListRow {
  id: string;
  lead_type: string;
  status: string;
  company_name: string;
  region: string;
  last_seen_at: string;
  metadata: Record<string, unknown>;
  latest_score: number | null;
  latest_reasoning: Record<string, unknown> | null;
}

export async function loadLeads(filters: {
  lead_type?: string;
  status?: string;
  min_score?: number;
}): Promise<LeadListRow[]> {
  const supabase = getServiceSupabase();
  let q = supabase
    .from("leads")
    .select(
      `
      id,
      lead_type,
      status,
      company_name,
      region,
      last_seen_at,
      metadata,
      lead_scores ( score, reasoning, created_at )
    `,
    )
    .order("last_seen_at", { ascending: false })
    .limit(100);

  if (filters.lead_type) {
    q = q.eq("lead_type", filters.lead_type);
  }
  if (filters.status) {
    q = q.eq("status", filters.status);
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((row) => {
    const scores = (row as { lead_scores?: Array<{ score: number; reasoning: unknown; created_at: string }> })
      .lead_scores;
    const sorted = [...(scores ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    );
    const latest = sorted[0];
    return {
      id: row.id,
      lead_type: row.lead_type,
      status: row.status,
      company_name: row.company_name,
      region: row.region,
      last_seen_at: row.last_seen_at,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      latest_score: latest?.score ?? null,
      latest_reasoning: (latest?.reasoning ?? null) as Record<
        string,
        unknown
      > | null,
    };
  });

  if (filters.min_score !== undefined) {
    return rows.filter((r) => (r.latest_score ?? 0) >= filters.min_score!);
  }
  return rows;
}

export type LeadDetailBundle = {
  lead: Record<string, unknown>;
  events: Array<{
    id: string;
    event_type: string;
    payload: unknown;
    created_at: string;
  }>;
  scores: Array<{
    id: string;
    score: number;
    reasoning: unknown;
    created_at: string;
  }>;
};

export async function loadLeadDetail(
  leadId: string,
): Promise<LeadDetailBundle | null> {
  const supabase = getServiceSupabase();
  const { data: lead, error: le } = await supabase
    .from("leads")
    .select("*")
    .eq("id", leadId)
    .maybeSingle();
  if (le || !lead) return null;

  const { data: events } = await supabase
    .from("lead_events")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  const { data: scores } = await supabase
    .from("lead_scores")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  return {
    lead: lead as unknown as Record<string, unknown>,
    events: (events ?? []) as LeadDetailBundle["events"],
    scores: (scores ?? []) as LeadDetailBundle["scores"],
  };
}
