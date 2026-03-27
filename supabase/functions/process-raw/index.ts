const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Database Webhook (raw_records INSERT) → HMAC-signed POST to Next.js batch processor.
 * Configure `INTERNAL_PROCESS_URL` to `https://<your-app>/api/process-raw`.
 */
Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const hmacSecret = Deno.env.get("LEADFLOW_HMAC_SECRET");
  const internalUrl = Deno.env.get("INTERNAL_PROCESS_URL");
  if (!hmacSecret || !internalUrl) {
    return new Response(
      JSON.stringify({
        error: "misconfigured",
        need: ["LEADFLOW_HMAC_SECRET", "INTERNAL_PROCESS_URL"],
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const bodyObj = {
    webhookDeliveryId: crypto.randomUUID(),
  };
  const body = JSON.stringify(bodyObj);
  const ts = Math.floor(Date.now() / 1000).toString();
  const hex = await hmacSha256Hex(hmacSecret, `${ts}.${body}`);
  const sig = `v1=${hex}`;

  const res = await fetch(internalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-LeadFlow-Timestamp": ts,
      "X-LeadFlow-Signature": sig,
    },
    body,
  });

  const text = await res.text();
  return new Response(text, {
    status: res.status,
    headers: { "Content-Type": "application/json" },
  });
});
