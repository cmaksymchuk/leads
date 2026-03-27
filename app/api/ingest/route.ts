import { getServiceSupabase } from "@/lib/db/server";
import { ingestBodySchema } from "@/lib/validation/ingest";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ingestBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { source, external_id, payload } = parsed.data;

  try {
    const supabase = getServiceSupabase();
    const { data, error } = await supabase
      .from("raw_records")
      .insert({
        source: source,
        external_id: external_id ?? null,
        payload: payload as object,
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "duplicate_external_id", code: error.code },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data.id, ingested: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
