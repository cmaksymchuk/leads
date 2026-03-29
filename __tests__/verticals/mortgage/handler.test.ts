import {
  CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  CAPTURE_SOURCE_MORTGAGE,
  RENEWAL_TIMEFRAME_0_6,
  RENEWAL_TIMEFRAME_12_PLUS,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import { representativeMonthsToRenewal } from "@/lib/capture/renewal";
import * as mortgage from "@/lib/processing/mortgage";
import { resolveVerticalHandler } from "@/lib/verticals/registry";
import { mortgageVerticalHandler } from "@/lib/verticals/mortgage/handler";
import { SOURCE_MB_ROLL_ENTRY_V1 } from "@/lib/verticals/sources";
import {
  SKIP_REASON_BELOW_THRESHOLD,
  SKIP_REASON_NO_CONSENT,
} from "@/lib/verticals/skip-reasons";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CONSENT_TS = "2026-01-01T00:00:00.000Z";

function capturePayload(consentGiven: boolean) {
  return {
    vertical_id: VERTICAL_MORTGAGE,
    identity: {
      name: "Alex Buyer",
      phone: "5551234567",
    },
    intent: {
      postal_code: "M5V2T6",
      province: "ON",
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

describe("mortgageVerticalHandler capture_mortgage_v1", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("capture with consent.given true and qualifying score promotes", () => {
    const r = mortgageVerticalHandler.qualify({
      id: "raw-1",
      source: CAPTURE_SOURCE_MORTGAGE,
      payload: capturePayload(true),
    });
    expect(r.kind).toBe("promote");
    if (r.kind === "promote") {
      expect(r.rowData.months_to_renewal).toBe(
        representativeMonthsToRenewal(RENEWAL_TIMEFRAME_0_6),
      );
    }
  });

  it("renewal_timeframe 0-6mo uses representative months that reach promote threshold", () => {
    expect(representativeMonthsToRenewal(RENEWAL_TIMEFRAME_0_6)).toBe(2);
    const r = mortgageVerticalHandler.qualify({
      id: "raw-0-6",
      source: CAPTURE_SOURCE_MORTGAGE,
      payload: capturePayload(true),
    });
    expect(r.kind).toBe("promote");
    if (r.kind === "promote") {
      expect(
        mortgage.shouldPromoteLead(
          r.rowData.score,
          r.rowData.months_to_renewal,
        ),
      ).toBe(true);
    }
  });

  it("capture with consent.given false and qualifying score skips with no_consent (does not promote)", () => {
    const spy = vi.spyOn(mortgage, "computeLeadScore");
    const r = mortgageVerticalHandler.qualify({
      id: "raw-2",
      source: CAPTURE_SOURCE_MORTGAGE,
      payload: capturePayload(false),
    });
    expect(spy).toHaveBeenCalled();
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") {
      expect(r.reason).toBe(SKIP_REASON_NO_CONSENT);
    }
  });

  it("capture with consent.given false and below-threshold score skips with below_threshold, not no_consent", () => {
    const r = mortgageVerticalHandler.qualify({
      id: "raw-3",
      source: CAPTURE_SOURCE_MORTGAGE,
      payload: {
        ...capturePayload(false),
        intent: {
          postal_code: "M5V2T6",
          province: "ON",
          renewal_timeframe: RENEWAL_TIMEFRAME_12_PLUS,
        },
      },
    });
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") {
      expect(r.reason).toBe(SKIP_REASON_BELOW_THRESHOLD);
    }
  });

  it("renewal_timeframe 12mo+ does not promote (months out of window)", () => {
    expect(representativeMonthsToRenewal(RENEWAL_TIMEFRAME_12_PLUS)).toBe(18);
    const r = mortgageVerticalHandler.qualify({
      id: "raw-12p",
      source: CAPTURE_SOURCE_MORTGAGE,
      payload: {
        ...capturePayload(true),
        intent: {
          postal_code: "M5V2T6",
          province: "ON",
          renewal_timeframe: RENEWAL_TIMEFRAME_12_PLUS,
        },
      },
    });
    expect(r.kind).toBe("skip");
    if (r.kind === "skip") {
      expect(r.reason).toBe(SKIP_REASON_BELOW_THRESHOLD);
    }
  });
});

describe("mortgageVerticalHandler mb_roll_entry_v1", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));
  });

  it("roll payload still qualifies and promotes when math passes threshold", () => {
    const rollPayload = {
      purchase_price: 800_000,
      purchase_date: "2021-06-20",
      contact_phone: "4165550100",
      address: "1 Main St",
      city: "Toronto",
      postal_code: "M5V2T6",
    };

    const r = mortgageVerticalHandler.qualify({
      id: "roll-1",
      source: SOURCE_MB_ROLL_ENTRY_V1,
      payload: rollPayload,
    });

    expect(r.kind).toBe("promote");
    if (r.kind === "promote") {
      expect(r.rowData.contact_phone).toBe("4165550100");
    }
  });
});

describe("vertical registry routing", () => {
  it("resolves capture_mortgage_v1 and mb_roll_entry_v1 to mortgage handler", () => {
    expect(resolveVerticalHandler(CAPTURE_SOURCE_MORTGAGE)).toBe(
      mortgageVerticalHandler,
    );
    expect(resolveVerticalHandler(SOURCE_MB_ROLL_ENTRY_V1)).toBe(
      mortgageVerticalHandler,
    );
  });

  it("unknown source is not registered (processOneRow yields unknown_vertical)", () => {
    expect(resolveVerticalHandler("unknown_partner_v1")).toBeUndefined();
  });
});
