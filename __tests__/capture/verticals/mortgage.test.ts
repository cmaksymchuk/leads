import {
  CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  RENEWAL_TIMEFRAME_0_6,
  RENEWAL_TIMEFRAME_12_PLUS,
  RENEWAL_TIMEFRAME_6_12,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import {
  captureMortgageRequestSchema,
  MORTGAGE_INTENT_PROVINCE_VALUES,
} from "@/lib/capture/schemas";
import {
  getVerticalMessageResolvers,
  getVerticalValidators,
} from "@/lib/capture/verticals";
import { mortgageCaptureConfig } from "@/lib/capture/verticals/mortgage";
import { describe, expect, it } from "vitest";

describe("mortgageCaptureConfig", () => {
  it("has five steps in order: renewal, province, name, phone, postal_code", () => {
    expect(mortgageCaptureConfig.steps.map((s) => s.id)).toEqual([
      "renewal_timeframe",
      "province",
      "name",
      "phone",
      "postal_code",
    ]);
  });

  it("maps renewal options to API renewal_timeframe values", () => {
    const step = mortgageCaptureConfig.steps.find(
      (s) => s.id === "renewal_timeframe",
    );
    expect(step?.optionMap).toEqual({
      "Within 6 months": RENEWAL_TIMEFRAME_0_6,
      "6–12 months": RENEWAL_TIMEFRAME_6_12,
      "More than a year": RENEWAL_TIMEFRAME_12_PLUS,
      "Not sure": RENEWAL_TIMEFRAME_12_PLUS,
    });
  });

  it("accepts valid Canadian postal codes and rejects invalid", () => {
    const v = getVerticalValidators("mortgage");
    expect(v.postal_code?.("M5V 2T6")).toBeNull();
    expect(v.postal_code?.("m5v2t6")).toBeNull();
    expect(v.postal_code?.("INVALID")).not.toBeNull();
  });

  it("validates phone with at least seven digits after stripping non-digits", () => {
    const v = getVerticalValidators("mortgage");
    expect(v.phone?.("(555) 123-4567")).toBeNull();
    expect(v.phone?.("12345")).not.toBeNull();
  });

  it("interpolates name in phone step bot message via client resolver", () => {
    const r = getVerticalMessageResolvers("mortgage");
    expect(r.phone({ name: "Sam" })).toContain("Sam");
  });

  it("province step option labels match Zod enum values exactly", () => {
    const step = mortgageCaptureConfig.steps.find((s) => s.id === "province");
    expect(step?.options).toEqual([...MORTGAGE_INTENT_PROVINCE_VALUES]);
  });

  it("fails Zod validation with intent.province field error when province is missing", () => {
    const parsed = captureMortgageRequestSchema.safeParse({
      vertical_id: VERTICAL_MORTGAGE,
      identity: { name: "x", phone: "5551234567" },
      intent: {
        postal_code: "M5V2T6",
        renewal_timeframe: RENEWAL_TIMEFRAME_0_6,
      },
      consent: {
        given: true,
        policy_version: CAPTURE_POLICY_VERSION_MORTGAGE_V1,
        timestamp: "2026-01-01T00:00:00.000Z",
      },
      attribution: {},
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const provinceIssue = parsed.error.issues.find(
        (i) => i.path.join(".") === "intent.province",
      );
      expect(provinceIssue).toBeDefined();
    }
  });
});
