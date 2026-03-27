import { getServiceSupabase } from "@/lib/db/server";

export interface LeadListRow {
  id: string;
  status: string;
  region: string;
  address: string;
  city: string;
  postal_code: string;
  contact_phone: string;
  payment_shock: number;
  months_to_renewal: number;
  score: number;
  updated_at: string;
}

export async function loadLeads(filters: {
  status?: string;
  region?: string;
  min_score?: number;
}): Promise<LeadListRow[]> {
  const supabase = getServiceSupabase();
  let q = supabase
    .from("leads")
    .select(
      `
      id,
      status,
      region,
      address,
      city,
      postal_code,
      contact_phone,
      payment_shock,
      months_to_renewal,
      score,
      updated_at
    `,
    )
    .order("score", { ascending: false })
    .limit(200);

  if (filters.status) {
    q = q.eq("status", filters.status);
  }
  if (filters.region) {
    q = q.eq("region", filters.region);
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []) as LeadListRow[];

  if (filters.min_score !== undefined) {
    return rows.filter((r) => r.score >= filters.min_score!);
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

  return {
    lead: lead as unknown as Record<string, unknown>,
    events: (events ?? []) as LeadDetailBundle["events"],
  };
}
