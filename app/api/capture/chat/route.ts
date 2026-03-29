import {
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import { NextRequest, NextResponse } from "next/server";

/**
 * AI-assisted capture chat — HTTP contract for future work (CaptureChat posts here when
 * NEXT_PUBLIC_CHAT_MODE=ai). Implement without changing CaptureChat.tsx:
 *
 * Request:  POST application/json
 *   { verticalSlug: string;
 *     messages: Array<{ role: "user" | "assistant"; content: string }>;
 *     sessionId?: string; }
 *
 * Response: 200 application/json { message: string }  (single assistant turn; streaming TBD)
 * Errors:   4xx/5xx with { error: string; message?: string }
 */
async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  void req;
  void ctx;
  return NextResponse.json(
    {
      error: "not_implemented",
      message: "AI capture chat is not implemented yet.",
    },
    { status: 501 },
  );
}

export const POST = withMonitoring(handlePost, {
  route: "/api/capture/chat",
  flow: "lead-capture",
});
