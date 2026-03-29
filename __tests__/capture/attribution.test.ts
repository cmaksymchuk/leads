import { readAttribution } from "@/lib/capture/attribution";
import { describe, expect, it } from "vitest";

describe("readAttribution", () => {
  it("extracts all UTM params when present", () => {
    const sp = new URLSearchParams();
    sp.set("utm_source", "google");
    sp.set("utm_medium", "cpc");
    sp.set("utm_campaign", "spring");
    sp.set("utm_content", "banner1");
    expect(readAttribution(sp)).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "spring",
      utm_content: "banner1",
    });
  });

  it("omits missing params (undefined, not null)", () => {
    const sp = new URLSearchParams();
    sp.set("utm_source", "x");
    const a = readAttribution(sp);
    expect(a.utm_medium).toBeUndefined();
    expect(a.utm_campaign).toBeUndefined();
    expect(a.utm_content).toBeUndefined();
    expect("utm_medium" in a && a.utm_medium === null).toBe(false);
  });

  it("includes landing_page when provided and non-empty", () => {
    const sp = new URLSearchParams();
    const a = readAttribution(sp, "https://example.com/landing?utm=x");
    expect(a.landing_page).toBe("https://example.com/landing?utm=x");
  });

  it("does not set landing_page for empty optional string", () => {
    const sp = new URLSearchParams();
    const a = readAttribution(sp, "");
    expect(a.landing_page).toBeUndefined();
  });
});
