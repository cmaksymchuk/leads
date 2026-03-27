import { getServiceSupabase } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * Dry-run outreach preview: does not send email or call webhooks.
 * Appends compliance footer from env when set.
 */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = getServiceSupabase();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", parsed.data.leadId)
    .maybeSingle();

  if (error || !lead) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const footer =
    process.env.LEADFLOW_COMPLIANCE_FOOTER ??
    "Reply STOP to opt out. This is a simulated message — not sent.";

  const preview = [
    `To: ${String(lead.contact_phone ?? "")}`,
    `Address: ${String(lead.address ?? "")}, ${String(lead.city ?? "")} ${String(lead.postal_code ?? "")}`,
    "",
    "[Simulated outreach body — not sent]",
    "",
    footer,
  ].join("\n");

  return NextResponse.json({ dryRun: true, preview });
}
