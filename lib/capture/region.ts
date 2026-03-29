import {
  normalizePostalCode,
  resolveRegion,
} from "@/lib/normalization/canada-lead";

/**
 * Resolves province/territory for capture storage. Returns null when postal is empty
 * or region cannot be resolved (unknown FSA → UN).
 */
export function resolveCaptureRegion(postalCode: string): string | null {
  try {
    const normalized = normalizePostalCode(postalCode);
    if (normalized.length < 1) {
      return null;
    }
    const region = resolveRegion({ postal_code: postalCode });
    if (region === "UN") {
      return null;
    }
    return region;
  } catch {
    return null;
  }
}
