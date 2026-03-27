"use server";

import { getServiceSupabase } from "@/lib/db/server";
import { revalidatePath } from "next/cache";

export async function markLeadSold(leadId: string): Promise<{ ok: boolean }> {
  const supabase = getServiceSupabase();
  const { data: row, error: selErr } = await supabase
    .from("leads")
    .select("status")
    .eq("id", leadId)
    .maybeSingle();

  if (selErr || !row || row.status !== "available") {
    return { ok: false };
  }

  const { error: upErr } = await supabase
    .from("leads")
    .update({
      status: "sold",
      updated_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  if (upErr) {
    return { ok: false };
  }

  await supabase.from("lead_events").insert({
    lead_id: leadId,
    event_type: "sold",
    payload: {},
  });

  revalidatePath("/dashboard");
  return { ok: true };
}
