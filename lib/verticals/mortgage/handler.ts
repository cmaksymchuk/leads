import {
  CAPTURE_SOURCE_MORTGAGE,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import { SOURCE_MB_ROLL_ENTRY_V1 } from "@/lib/verticals/sources";
import { representativeMonthsToRenewal } from "@/lib/capture/renewal";
import {
  captureMortgageRequestSchema,
  type CaptureMortgageRequest,
} from "@/lib/capture/schemas";
import {
  normalizeLeadData,
  resolveRegion,
} from "@/lib/normalization/canada-lead";
import {
  computeLeadScore,
  computeMortgageBalance,
  computePaymentShock,
  fullMonthsFromNowTo,
  parsePurchaseDate,
  renewalDateFromPurchase,
  shouldPromoteLead,
} from "@/lib/processing/mortgage";
import type {
  LeadUpsertPayload,
  RawRecordRow,
  VerticalHandler,
  VerticalQualifyResult,
} from "@/lib/verticals/types";
import {
  SKIP_REASON_BELOW_THRESHOLD,
  SKIP_REASON_INVALID_PAYLOAD,
  SKIP_REASON_NO_CONSENT,
  SKIP_REASON_NO_PHONE,
} from "@/lib/verticals/skip-reasons";
import {
  canadaMortgagePayloadSchema,
  type CanadaMortgagePayload,
} from "@/lib/validation/canada-payload";
import { LEAD_STATUS_AVAILABLE } from "@/types/leads";
import { z } from "zod";

function phoneFromRollPayload(payload: unknown): string {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "contact_phone" in payload
  ) {
    return String(
      (payload as { contact_phone?: unknown }).contact_phone ?? "",
    ).trim();
  }
  return "";
}

export type MortgageLeadShapeContext = {
  norm: ReturnType<typeof normalizeLeadData>;
  paymentShock: number;
  monthsToRenewal: number;
  score: number;
};

export type CaptureMortgageLeadShapeContext = {
  norm: ReturnType<typeof normalizeLeadData>;
  paymentShock: number;
  monthsToRenewal: number;
  score: number;
};

export function mortgageToLeadShape(
  parsed: CanadaMortgagePayload,
  ctx: MortgageLeadShapeContext,
): LeadUpsertPayload {
  return {
    fingerprint: ctx.norm.fingerprint,
    contact_phone: parsed.contact_phone.trim(),
    address: ctx.norm.normalizedAddress,
    city: ctx.norm.normalizedCity,
    postal_code: ctx.norm.normalizedPostalCode,
    region: ctx.norm.region,
    payment_shock: ctx.paymentShock,
    months_to_renewal: ctx.monthsToRenewal,
    score: ctx.score,
    status: LEAD_STATUS_AVAILABLE,
    updated_at: new Date().toISOString(),
  };
}

export function captureMortgageToLeadShape(
  parsed: CaptureMortgageRequest,
  ctx: CaptureMortgageLeadShapeContext,
): LeadUpsertPayload {
  return {
    fingerprint: ctx.norm.fingerprint,
    contact_phone: parsed.identity.phone,
    address: ctx.norm.normalizedAddress,
    city: ctx.norm.normalizedCity,
    postal_code: ctx.norm.normalizedPostalCode,
    region: ctx.norm.region,
    payment_shock: ctx.paymentShock,
    months_to_renewal: ctx.monthsToRenewal,
    score: ctx.score,
    status: LEAD_STATUS_AVAILABLE,
    updated_at: new Date().toISOString(),
  };
}

function qualifyMbRollEntry(row: RawRecordRow): VerticalQualifyResult {
  if (!phoneFromRollPayload(row.payload)) {
    return { kind: "skip", reason: SKIP_REASON_NO_PHONE };
  }

  const parsed = canadaMortgagePayloadSchema.safeParse(row.payload);
  if (!parsed.success) {
    return { kind: "skip", reason: SKIP_REASON_INVALID_PAYLOAD };
  }

  const p = parsed.data;
  const resolvedRegion = resolveRegion({
    postal_code: p.postal_code,
    region: p.region,
  });

  const purchaseDate = parsePurchaseDate(p.purchase_date);
  const renewal = renewalDateFromPurchase(purchaseDate);
  const monthsToRenewal = fullMonthsFromNowTo(renewal);
  const mortgageBalance = computeMortgageBalance(p.purchase_price);
  const paymentShock = computePaymentShock(mortgageBalance);
  const score = computeLeadScore(monthsToRenewal, paymentShock);

  const norm = normalizeLeadData({
    address: p.address,
    city: p.city,
    postal_code: p.postal_code,
    region: resolvedRegion,
  });

  if (!shouldPromoteLead(score, monthsToRenewal)) {
    return {
      kind: "skip",
      reason: SKIP_REASON_BELOW_THRESHOLD,
      region: resolvedRegion,
    };
  }

  const rowData = mortgageToLeadShape(p, {
    norm,
    paymentShock,
    monthsToRenewal,
    score,
  });

  return {
    kind: "promote",
    region: resolvedRegion,
    rowData,
  };
}

/**
 * Capture path order (scoring always runs for observability):
 * 1. Parse/validate payload → 2. Resolve region → 3. Mortgage math + scoring →
 * 4. shouldPromoteLead → 5. consent.given (if false: SKIP_REASON_NO_CONSENT) → 6. promote.
 */
function qualifyCaptureMortgage(row: RawRecordRow): VerticalQualifyResult {
  const parsed = captureMortgageRequestSchema.safeParse(row.payload);
  if (!parsed.success) {
    return { kind: "skip", reason: SKIP_REASON_INVALID_PAYLOAD };
  }

  const p = parsed.data;
  if (p.identity.phone.length < 7) {
    return { kind: "skip", reason: SKIP_REASON_NO_PHONE };
  }

  const resolvedRegion = resolveRegion({
    postal_code: p.intent.postal_code,
  });

  const monthsToRenewal = representativeMonthsToRenewal(
    p.intent.renewal_timeframe,
  );
  const mortgageBalance = 0;
  const paymentShock = computePaymentShock(mortgageBalance);
  const score = computeLeadScore(monthsToRenewal, paymentShock);

  const norm = normalizeLeadData({
    address: p.identity.name,
    city: "",
    postal_code: p.intent.postal_code,
    region: resolvedRegion,
  });

  if (!shouldPromoteLead(score, monthsToRenewal)) {
    return {
      kind: "skip",
      reason: SKIP_REASON_BELOW_THRESHOLD,
      region: resolvedRegion,
    };
  }

  if (!p.consent.given) {
    return {
      kind: "skip",
      reason: SKIP_REASON_NO_CONSENT,
      region: resolvedRegion,
    };
  }

  const rowData = captureMortgageToLeadShape(p, {
    norm,
    paymentShock,
    monthsToRenewal,
    score,
  });

  return {
    kind: "promote",
    region: resolvedRegion,
    rowData,
  };
}

function mortgageQualify(row: RawRecordRow): VerticalQualifyResult {
  if (row.source === CAPTURE_SOURCE_MORTGAGE) {
    return qualifyCaptureMortgage(row);
  }
  return qualifyMbRollEntry(row);
}

export const mortgageVerticalHandler: VerticalHandler = {
  sources: [SOURCE_MB_ROLL_ENTRY_V1, CAPTURE_SOURCE_MORTGAGE] as const,
  schema: z.union([canadaMortgagePayloadSchema, captureMortgageRequestSchema]),
  qualify: mortgageQualify,
  toLeadShape(parsed: unknown, ctx: unknown): LeadUpsertPayload {
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "vertical_id" in parsed &&
      (parsed as { vertical_id?: unknown }).vertical_id === VERTICAL_MORTGAGE
    ) {
      return captureMortgageToLeadShape(
        parsed as CaptureMortgageRequest,
        ctx as CaptureMortgageLeadShapeContext,
      );
    }
    return mortgageToLeadShape(
      parsed as CanadaMortgagePayload,
      ctx as MortgageLeadShapeContext,
    );
  },
};
