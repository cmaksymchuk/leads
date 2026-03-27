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

export function normalizeLeadData(input: {
  address: string;
  city: string;
  postal_code: string;
}): {
  normalizedAddress: string;
  normalizedCity: string;
  normalizedPostalCode: string;
  fingerprint: string;
} {
  const normalizedCity = stripPunctuationForAddress(input.city);
  const normalizedPostalCode = normalizePostalCode(input.postal_code);
  const normalizedAddress = applySuffixes(
    stripPunctuationForAddress(input.address),
  );

  const basis = `${normalizedAddress}|${normalizedCity}|${normalizedPostalCode}`;
  const fingerprint = createHash("sha256").update(basis, "utf8").digest("hex");

  return {
    normalizedAddress,
    normalizedCity,
    normalizedPostalCode,
    fingerprint,
  };
}
