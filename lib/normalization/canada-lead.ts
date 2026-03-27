import { createHash } from "node:crypto";

/** Longer tokens first so "street" matches before "st" would. */
const ADDRESS_SUFFIXES: Array<[RegExp, string]> = [
  [/\bavenue\b/gi, "ave"],
  [/\bstreet\b/gi, "st"],
  [/\bdrive\b/gi, "dr"],
  [/\broad\b/gi, "rd"],
  [/\bcrescent\b/gi, "cres"],
  [/\blane\b/gi, "ln"],
  [/\bcourt\b/gi, "ct"],
  [/\bplace\b/gi, "pl"],
];

/** First letter of Canadian postal FSA → province/territory code (Canada Post). */
const POSTAL_FIRST_TO_REGION: Record<string, string> = {
  A: "NL",
  B: "NS",
  C: "PE",
  E: "NB",
  G: "QC",
  H: "QC",
  J: "QC",
  K: "ON",
  L: "ON",
  M: "ON",
  N: "ON",
  P: "ON",
  R: "MB",
  S: "SK",
  T: "AB",
  V: "BC",
  Y: "YT",
};

function stripPunctuationForAddress(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function applySuffixes(address: string): string {
  let s = address;
  for (const [re, rep] of ADDRESS_SUFFIXES) {
    s = s.replace(re, rep);
  }
  return s.replace(/\s+/g, " ").trim();
}

export function normalizePostalCode(raw: string): string {
  return raw.replace(/[\s\-._]/g, "").toUpperCase();
}

/**
 * Maps the postal code’s FSA to a province/territory code (e.g. R → MB, T → AB).
 * X0… → NT, X1… → NU per rural postal conventions; unknown → UN.
 */
export function getRegionFromPostal(pc: string): string {
  const normalized = normalizePostalCode(pc);
  if (normalized.length < 1) {
    return "UN";
  }
  const letter = normalized[0].toUpperCase();

  if (letter === "X") {
    if (normalized.length >= 2) {
      const d = normalized[1];
      if (d === "0") return "NT";
      if (d === "1") return "NU";
    }
    return "NT";
  }

  return POSTAL_FIRST_TO_REGION[letter] ?? "UN";
}

const KNOWN_PROVINCE_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
  "UN",
]);

/** Prefer explicit 2-letter payload override when valid; else derive from postal. */
export function resolveRegion(input: {
  postal_code: string;
  region?: string | null;
}): string {
  const o = input.region?.trim().toUpperCase();
  if (o && KNOWN_PROVINCE_CODES.has(o)) {
    return o;
  }
  return getRegionFromPostal(input.postal_code);
}

/**
 * Dedupe key: same physical lead in the same province (postal no longer in hash).
 */
export function getLeadFingerprint(parts: {
  normalizedAddress: string;
  normalizedCity: string;
  region: string;
}): string {
  const basis = `${parts.normalizedAddress}|${parts.normalizedCity}|${parts.region}`;
  return createHash("sha256").update(basis, "utf8").digest("hex");
}

export function normalizeLeadData(input: {
  address: string;
  city: string;
  postal_code: string;
  region: string;
}): {
  normalizedAddress: string;
  normalizedCity: string;
  normalizedPostalCode: string;
  region: string;
  fingerprint: string;
} {
  const normalizedCity = stripPunctuationForAddress(input.city);
  const normalizedPostalCode = normalizePostalCode(input.postal_code);
  const normalizedAddress = applySuffixes(
    stripPunctuationForAddress(input.address),
  );
  const region = input.region.trim().toUpperCase() || "UN";

  const fingerprint = getLeadFingerprint({
    normalizedAddress,
    normalizedCity,
    region,
  });

  return {
    normalizedAddress,
    normalizedCity,
    normalizedPostalCode,
    region,
    fingerprint,
  };
}

/** Province/territory codes for dashboard filters (includes UN for unknown). */
export const CANADA_REGION_CODES = [
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
  "UN",
] as const;
