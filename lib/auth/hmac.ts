import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyHmacSignature(opts: {
  secret: string;
  timestamp: string;
  body: string;
  signatureHeader: string | null;
  maxSkewSeconds: number;
}): { ok: true } | { ok: false; reason: string } {
  const { secret, timestamp, body, signatureHeader, maxSkewSeconds } = opts;
  if (!signatureHeader?.startsWith("v1=")) {
    return { ok: false, reason: "invalid_signature_format" };
  }
  const ts = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) {
    return { ok: false, reason: "invalid_timestamp" };
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - ts) > maxSkewSeconds) {
    return { ok: false, reason: "timestamp_skew" };
  }
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  const expected = `v1=${mac}`;
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signatureHeader, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, reason: "invalid_signature" };
  }
  return { ok: true };
}

export function signHmacPayload(secret: string, timestamp: string, body: string): string {
  const mac = createHmac("sha256", secret)
    .update(`${timestamp}.${body}`)
    .digest("hex");
  return `v1=${mac}`;
}
