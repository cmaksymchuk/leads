import { VERTICAL_MORTGAGE } from "@/lib/capture/constants";
import {
  getVerticalCaptureConfigByApiVerticalId,
} from "@/lib/capture/verticals";
import { mortgageCaptureConfig } from "@/lib/capture/verticals/mortgage";
import { describe, expect, it } from "vitest";

describe("getVerticalCaptureConfigByApiVerticalId", () => {
  it("returns config when apiVerticalId matches a registered vertical", () => {
    expect(getVerticalCaptureConfigByApiVerticalId(VERTICAL_MORTGAGE)).toBe(
      mortgageCaptureConfig,
    );
  });

  it("returns null for unknown apiVerticalId", () => {
    expect(getVerticalCaptureConfigByApiVerticalId("not-a-vertical")).toBeNull();
  });
});
