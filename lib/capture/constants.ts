/** Mortgage vertical id (POST /api/capture body.vertical_id). */
export const VERTICAL_MORTGAGE = "mortgage" as const;

export const VERTICAL_IDS = [VERTICAL_MORTGAGE] as const;
export type VerticalId = (typeof VERTICAL_IDS)[number];

export function isVerticalId(value: string): value is VerticalId {
  return (VERTICAL_IDS as readonly string[]).includes(value);
}

/** Suffix for capture source column: capture_<vertical>_v1 */
export const CAPTURE_SOURCE_VERSION_TAG = "v1" as const;

export function buildCaptureSource(verticalId: VerticalId): string {
  return `capture_${verticalId}_${CAPTURE_SOURCE_VERSION_TAG}`;
}

export const CAPTURE_SOURCE_MORTGAGE = buildCaptureSource(VERTICAL_MORTGAGE);

/** raw_records.status for newly ingested capture rows */
export const RAW_RECORD_STATUS_PENDING = "pending" as const;

/** Example policy_version for mortgage capture (documented contract; not enforced as only value). */
export const CAPTURE_POLICY_VERSION_MORTGAGE_V1 = "mortgage-v1" as const;

export const RENEWAL_TIMEFRAME_0_6 = "0-6mo" as const;
export const RENEWAL_TIMEFRAME_6_12 = "6-12mo" as const;
export const RENEWAL_TIMEFRAME_12_PLUS = "12mo+" as const;

export const RENEWAL_TIMEFRAMES = [
  RENEWAL_TIMEFRAME_0_6,
  RENEWAL_TIMEFRAME_6_12,
  RENEWAL_TIMEFRAME_12_PLUS,
] as const;
export type RenewalTimeframe = (typeof RENEWAL_TIMEFRAMES)[number];

/** API error codes (response body.error) */
export const CAPTURE_ERROR_UNKNOWN_VERTICAL_ID = "unknown_vertical_id" as const;
export const CAPTURE_ERROR_VALIDATION = "validation_error" as const;
export const CAPTURE_ERROR_INVALID_JSON = "invalid_json" as const;
export const CAPTURE_RESPONSE_INTERNAL_ERROR = "internal_error" as const;
