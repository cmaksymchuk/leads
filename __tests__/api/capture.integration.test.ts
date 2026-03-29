import { POST } from "@/app/api/capture/route";
import {
  buildCaptureSource,
  CAPTURE_ERROR_VALIDATION,
  CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  RAW_RECORD_STATUS_PENDING,
  RENEWAL_TIMEFRAME_0_6,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import { getServiceSupabase } from "@/lib/db/server";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/server", () => ({
  getServiceSupabase: vi.fn(),
}));

const CONSENT_TS = "2026-06-01T12:00:00.000Z";

function mortgageCaptureBody(consentGiven: boolean) {
  return {
    vertical_id: VERTICAL_MORTGAGE,
    identity: {
      name: "Integration User",
      phone: "4165550199",
    },
    intent: {
      postal_code: "M5V2T6",
      province: "MB",
      renewal_timeframe: RENEWAL_TIMEFRAME_0_6,
    },
    consent: {
      given: consentGiven,
      policy_version: CAPTURE_POLICY_VERSION_MORTGAGE_V1,
      timestamp: CONSENT_TS,
    },
    attribution: {},
  };
}

describe("POST /api/capture integration", () => {
  const insertedRows: Array<{
    source: string;
    payload: unknown;
    region: string | null;
    status: string;
  }> = [];

  afterEach(() => {
    vi.mocked(getServiceSupabase).mockReset();
    insertedRows.length = 0;
  });

  beforeEach(() => {
    let idSeq = 0;
    vi.mocked(getServiceSupabase).mockReturnValue({
      from: () => ({
        insert: (row: {
          source: string;
          payload: unknown;
          region: string | null;
          status: string;
        }) => {
          insertedRows.push(row);
          idSeq += 1;
          return {
            select: () => ({
              single: async () => ({
                data: { id: `rec-integration-${idSeq}` },
                error: null,
              }),
            }),
          };
        },
      }),
    } as unknown as ReturnType<typeof getServiceSupabase>);
  });

  it("stores raw_record and returns success when consent.given is true", async () => {
    const body = mortgageCaptureBody(true);
    const req = new NextRequest("http://localhost/api/capture", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      success: boolean;
      record_id?: string;
    };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.record_id).toMatch(/^rec-integration-/);

    expect(insertedRows).toHaveLength(1);
    const row = insertedRows[0];
    expect(row.source).toBe(buildCaptureSource(VERTICAL_MORTGAGE));
    expect(row.status).toBe(RAW_RECORD_STATUS_PENDING);
    expect(row.payload).toEqual(body);
    expect((row.payload as { consent: { given: boolean } }).consent.given).toBe(
      true,
    );
  });

  it("still inserts and returns success when consent.given is false", async () => {
    const body = mortgageCaptureBody(false);
    const req = new NextRequest("http://localhost/api/capture", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      success: boolean;
      record_id?: string;
    };

    expect(res.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.record_id).toMatch(/^rec-integration-/);

    expect(insertedRows).toHaveLength(1);
    expect((insertedRows[0].payload as { consent: { given: boolean } }).consent.given).toBe(
      false,
    );
  });

  it("returns 400 with field error when intent.province is missing", async () => {
    const body = {
      ...mortgageCaptureBody(true),
      intent: {
        postal_code: "M5V2T6",
        renewal_timeframe: RENEWAL_TIMEFRAME_0_6,
      },
    };
    const req = new NextRequest("http://localhost/api/capture", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req);
    const json = (await res.json()) as {
      success: boolean;
      error?: string;
      fields?: Record<string, string>;
    };

    expect(res.status).toBe(400);
    expect(json.success).toBe(false);
    expect(json.error).toBe(CAPTURE_ERROR_VALIDATION);
    expect(json.fields?.["intent.province"]).toBeDefined();
    expect(insertedRows).toHaveLength(0);
  });
});
