import {
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import {
  CAPTURE_ERROR_INVALID_JSON,
} from "@/lib/capture/constants";
import { processCaptureIngest } from "@/lib/capture/process-capture-request";
import { resolveCaptureRegion } from "@/lib/capture/region";
import { getServiceSupabase } from "@/lib/db/server";
import { NextRequest, NextResponse } from "next/server";

async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  const { requestId } = ctx;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: CAPTURE_ERROR_INVALID_JSON },
      {
        status: 400,
        headers: { "x-request-id": requestId },
      },
    );
  }

  const result = await processCaptureIngest(json, {
    supabase: getServiceSupabase(),
    resolveCaptureRegion,
    requestId,
  });

  if (!result.ok) {
    if (result.status === 500) {
      return NextResponse.json(
        { success: false, error: result.error },
        {
          status: 500,
          headers: { "x-request-id": requestId },
        },
      );
    }
    return NextResponse.json(
      {
        success: false,
        error: result.error,
        ...(result.fields ? { fields: result.fields } : {}),
      },
      {
        status: 400,
        headers: { "x-request-id": requestId },
      },
    );
  }

  return NextResponse.json(
    { success: true, record_id: result.recordId },
    {
      status: 200,
      headers: { "x-request-id": requestId },
    },
  );
}

export const POST = withMonitoring(handlePost, {
  route: "/api/capture",
  flow: "lead-capture",
});
