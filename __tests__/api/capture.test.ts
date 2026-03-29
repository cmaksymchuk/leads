import { POST } from "@/app/api/capture/route";
import {
  buildCaptureSource,
  CAPTURE_ERROR_UNKNOWN_VERTICAL_ID,
  CAPTURE_ERROR_VALIDATION,
  CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  CAPTURE_RESPONSE_INTERNAL_ERROR,
  RAW_RECORD_STATUS_PENDING,
  RENEWAL_TIMEFRAME_0_6,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import { processCaptureIngest } from "@/lib/capture/process-capture-request";
import type { RawRecordsInsertClient } from "@/lib/capture/process-capture-request";
import { getServiceSupabase } from "@/lib/db/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({
  getServiceSupabase: vi.fn(),
}));

const CONSENT_TS = "2026-03-27T18:00:00.000Z";

function baseMortgageBody() {
  return {
    vertical_id: VERTICAL_MORTGAGE,
    identity: {
      name: "Jane Doe",
      phone: "(555) 123-4567",
      email: "jane@example.com",
    },
    intent: {
      postal_code: "M5V2T6",
      province: "ON",
      renewal_timeframe: RENEWAL_TIMEFRAME_0_6,
    },
    consent: {
      given: true,
      policy_version: CAPTURE_POLICY_VERSION_MORTGAGE_V1,
      timestamp: CONSENT_TS,
    },
    attribution: { utm_source: "google" },
  };
}

function mockSupabase(
  singleResult: {
    data: { id: string } | null;
    error: { message: string; code?: string } | null;
  },
  onInsert?: (row: {
    source: string;
    payload: unknown;
    region: string | null;
    status: typeof RAW_RECORD_STATUS_PENDING;
  }) => void,
): RawRecordsInsertClient {
  return {
    from: () => ({
      insert: (row: {
        source: string;
        payload: unknown;
        region: string | null;
        status: typeof RAW_RECORD_STATUS_PENDING;
      }) => {
        onInsert?.(row);
        return {
          select: () => ({
            single: async () => singleResult,
          }),
        };
      },
    }),
  } as RawRecordsInsertClient;
}

describe("processCaptureIngest", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("accepts valid mortgage submission with consent.given false (stored like any other valid body)", async () => {
    const body = {
      ...baseMortgageBody(),
      consent: { ...baseMortgageBody().consent, given: false },
    };
    const supabase = mockSupabase({ data: { id: "rec-nc" }, error: null });

    const r = await processCaptureIngest(body, {
      supabase,
      resolveCaptureRegion: () => "ON",
      requestId: "req-nc",
    });

    expect(r.ok).toBe(true);
  });

  it("accepts valid mortgage submission with consent and inserts stripped phone", async () => {
    const body = baseMortgageBody();
    let insertedPayload: unknown;
    const supabase = mockSupabase({ data: { id: "rec-1" }, error: null }, (row) => {
      insertedPayload = row.payload;
    });

    const r = await processCaptureIngest(body, {
      supabase,
      resolveCaptureRegion: () => "ON",
      requestId: "req-1",
    });

    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recordId).toBe("rec-1");
    }
    expect(
      (insertedPayload as { identity: { phone: string } }).identity.phone,
    ).toBe("5551234567");
    expect(
      (insertedPayload as { vertical_id: string }).vertical_id,
    ).toBe(VERTICAL_MORTGAGE);
    const inserted = insertedPayload as { consent: { given: boolean } };
    expect(inserted.consent.given).toBe(true);
  });

  it("sets source capture_mortgage_v1 and pending status", async () => {
    let source = "";
    let status: string | undefined;
    const supabase = mockSupabase({ data: { id: "x" }, error: null }, (row) => {
      source = row.source;
      status = row.status;
    });

    await processCaptureIngest(baseMortgageBody(), {
      supabase,
      resolveCaptureRegion: () => "ON",
      requestId: "req-src",
    });

    expect(source).toBe(buildCaptureSource(VERTICAL_MORTGAGE));
    expect(status).toBe(RAW_RECORD_STATUS_PENDING);
  });

  it("stores region null when resolveCaptureRegion returns null without throwing", async () => {
    const body = baseMortgageBody();
    let region: string | null | undefined;
    const supabase = mockSupabase({ data: { id: "rec-2" }, error: null }, (row) => {
      region = row.region;
    });

    const r = await processCaptureIngest(body, {
      supabase,
      resolveCaptureRegion: () => null,
      requestId: "req-2",
    });

    expect(r.ok).toBe(true);
    expect(region).toBeNull();
  });

  it("returns 400 for unknown vertical_id", async () => {
    const r = await processCaptureIngest(
      { ...baseMortgageBody(), vertical_id: "insurance" },
      {
        supabase: mockSupabase({ data: null, error: null }),
        resolveCaptureRegion: () => "ON",
        requestId: "req-3",
      },
    );

    expect(r.ok).toBe(false);
    if (!r.ok && r.status === 400) {
      expect(r.error).toBe(CAPTURE_ERROR_UNKNOWN_VERTICAL_ID);
      expect(r.fields?.vertical_id).toBeDefined();
    }
  });

  it("returns 400 with field map for missing required fields", async () => {
    const bad = {
      ...baseMortgageBody(),
      identity: { name: "", phone: "5551234567" },
    };
    const r = await processCaptureIngest(bad, {
      supabase: mockSupabase({ data: null, error: null }),
      resolveCaptureRegion: () => "ON",
      requestId: "req-4",
    });

    expect(r.ok).toBe(false);
    if (!r.ok && r.status === 400) {
      expect(r.error).toBe(CAPTURE_ERROR_VALIDATION);
      expect(r.fields && "identity.name" in r.fields).toBe(true);
    }
  });

  it("returns 500 on Supabase insert error", async () => {
    const supabase = mockSupabase({
      data: null,
      error: { message: "db down", code: "57014" },
    });

    const r = await processCaptureIngest(baseMortgageBody(), {
      supabase,
      resolveCaptureRegion: () => "ON",
      requestId: "req-5",
    });

    expect(r.ok).toBe(false);
    if (!r.ok && r.status === 500) {
      expect(r.error).toBe(CAPTURE_RESPONSE_INTERNAL_ERROR);
    }
  });
});

describe("POST /api/capture", () => {
  afterEach(() => {
    vi.mocked(getServiceSupabase).mockReset();
  });

  beforeEach(() => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({ data: { id: "route-id" }, error: null }) as unknown as ReturnType<
        typeof getServiceSupabase
      >,
    );
  });

  it("returns JSON success with record_id and x-request-id", async () => {
    const req = new NextRequest("http://localhost/api/capture", {
      method: "POST",
      body: JSON.stringify(baseMortgageBody()),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      success: boolean;
      record_id?: string;
    };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.record_id).toBe("route-id");
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });
});
