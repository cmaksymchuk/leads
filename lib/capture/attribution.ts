export type CaptureAttribution = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  landing_page?: string;
};

/** Minimal surface for Next.js `useSearchParams()` or `URLSearchParams`. */
export type CaptureSearchParams = {
  get(name: string): string | null;
};

/**
 * Extracts marketing attribution from URL search params. Missing keys are omitted
 * (undefined), never null. Optional `landingPage` sets `landing_page` when non-empty.
 */
export function readAttribution(
  searchParams: CaptureSearchParams,
  landingPage?: string,
): CaptureAttribution {
  const out: CaptureAttribution = {};
  const u = searchParams.get("utm_source");
  const m = searchParams.get("utm_medium");
  const c = searchParams.get("utm_campaign");
  const x = searchParams.get("utm_content");
  if (u !== null && u !== "") out.utm_source = u;
  if (m !== null && m !== "") out.utm_medium = m;
  if (c !== null && c !== "") out.utm_campaign = c;
  if (x !== null && x !== "") out.utm_content = x;
  if (landingPage !== undefined && landingPage !== "") {
    out.landing_page = landingPage;
  }
  return out;
}
