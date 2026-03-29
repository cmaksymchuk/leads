import {
  RENEWAL_TIMEFRAME_0_6,
  RENEWAL_TIMEFRAME_12_PLUS,
  RENEWAL_TIMEFRAME_6_12,
  type RenewalTimeframe,
} from "@/lib/capture/constants";

/**
 * Representative months-to-renewal for scoring. Capture payloads have no
 * purchase price, so 0–6mo uses a value in the under-3-month bucket so renewal signal
 * alone can reach the promote threshold with zero payment shock.
 */
export function representativeMonthsToRenewal(tf: RenewalTimeframe): number {
  switch (tf) {
    case RENEWAL_TIMEFRAME_0_6:
      return 2;
    case RENEWAL_TIMEFRAME_6_12:
      return 9;
    case RENEWAL_TIMEFRAME_12_PLUS:
      return 18;
    default: {
      const _exhaustive: never = tf;
      return _exhaustive;
    }
  }
}
