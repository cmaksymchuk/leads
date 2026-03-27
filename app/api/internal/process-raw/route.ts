import { verifyHmacSignature } from "@/lib/auth/hmac";
import { HMAC_MAX_SKEW_SECONDS } from "@/lib/processing/constants";
import { processRawRecord } from "@/lib/processing/process-raw-record";
import { NextRequest, NextResponse } from "next/server";

const bodySchema = (raw: unknown): raw is { rawRecordId: string } => {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "rawRecordId" in raw &&
    typeof (raw as { rawRecordId: unknown }).rawRecordId === "string" &&
    (raw as { rawRecordId: string }).rawRecordId.length > 0
  );
};

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

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!bodySchema(parsed)) {
    return NextResponse.json({ error: "rawRecordId_required" }, { status: 400 });
  }

  const result = await processRawRecord(parsed.rawRecordId);
  const status =
    result.status === "error"
      ? 500
      : result.status === "skipped"
        ? 200
        : 200;
  return NextResponse.json(result, { status });
}
