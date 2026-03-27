import {
  apiErrorJson,
  apiJson,
  logger,
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import { getServiceSupabase } from "@/lib/db/server";
import { NextRequest } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  leadId: z.string().uuid(),
});

/**
 * Dry-run outreach preview: does not send email or call webhooks.
 * Appends compliance footer from env when set.
 */
async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  const { requestId } = ctx;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiErrorJson({ error: "invalid_json" }, 400, requestId);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiErrorJson(
      { error: "validation_error", details: parsed.error.flatten() },
      400,
      requestId,
    );
  }

  const supabase = getServiceSupabase();
  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", parsed.data.leadId)
    .maybeSingle();

  if (error) {
    logger.error("preview_lead_fetch_failed", {
      route: "/api/preview-outreach",
      flow: "preview",
      requestId,
      code: error.code,
    });
    return apiErrorJson({ error: "server_error" }, 500, requestId);
  }

  if (!lead) {
    return apiErrorJson({ error: "not_found" }, 404, requestId);
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

  return apiJson({ dryRun: true, preview }, 200, requestId);
}

export const POST = withMonitoring(handlePost, {
  route: "/api/preview-outreach",
  flow: "preview",
});
