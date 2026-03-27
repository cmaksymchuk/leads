import { verifyHmacSignature } from "@/lib/auth/hmac";
import { HMAC_MAX_SKEW_SECONDS } from "@/lib/processing/constants";
import { processRawBatch } from "@/lib/processing/process-raw-record";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z
  .object({
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const secret = process.env.LEADFLOW_HMAC_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "server_misconfigured", detail: "LEADFLOW_HMAC_SECRET" },
      { status: 500 },
    );
  }

  const bodyText = await req.text();
  const ts = req.headers.get("x-leadflow-timestamp");
  const sig = req.headers.get("x-leadflow-signature");

  if (!ts || !sig) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const verified = verifyHmacSignature({
    secret,
    timestamp: ts,
    body: bodyText,
    signatureHeader: sig,
    maxSkewSeconds: HMAC_MAX_SKEW_SECONDS,
  });

  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  let parsed: unknown = {};
  if (bodyText.length > 0) {
    try {
      parsed = JSON.parse(bodyText);
    } catch {
      return NextResponse.json({ error: "invalid_json" }, { status: 400 });
    }
  }

  const body = bodySchema.safeParse(parsed);
  if (!body.success) {
    return NextResponse.json(
      { error: "validation_error", details: body.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await processRawBatch(body.data.limit ?? 10);
    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: "process_failed", message }, { status: 500 });
  }
}
