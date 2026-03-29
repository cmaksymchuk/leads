import {
  FORBIDDEN_PATTERNS,
  SAFE_FALLBACK_RESPONSE,
  validateAIResponse,
} from "@/lib/capture/ai/response-validator";
import { describe, expect, it } from "vitest";

describe("validateAIResponse", () => {
  it.each([
    ["rates are around 5.5%", "percentage_mentioned"],
    ["your payment would be $1,400", "dollar_amount_mentioned"],
    ["I'd recommend locking in", "advice_given"],
    ["TD is offering good rates", "lender_mentioned"],
    ["the Bank of Canada raised rates", "central_bank_mentioned"],
    ["please refinance before renewal", "course_of_action_recommended"],
    ["your income will be considered", "financial_pii_requested"],
    ["your payment would be higher next year", "payment_projection_given"],
    ["the posted rate looks attractive", "rate_type_mentioned"],
    ["your rate is terrible", "rate_opinion_given"],
  ])("flags forbidden content: %s → %s", (text, reason) => {
    const r = validateAIResponse(text);
    expect(r.safe).toBe(false);
    expect(r.reason).toBe(reason);
  });

  it("matches every FORBIDDEN_PATTERNS entry against an explicit example", () => {
    const examples: Record<string, string> = {
      percentage_mentioned: "rates near 4.25 % today",
      dollar_amount_mentioned: "save $2,000",
      rate_type_mentioned: "fixed rate deal",
      central_bank_mentioned: "BoC paused hikes",
      lender_mentioned: "BMO has a promo",
      advice_given: "i suggest you wait",
      rate_opinion_given: "that rate is great",
      payment_projection_given: "payment could jump",
      course_of_action_recommended: "time to refinance",
      financial_pii_requested: "what is your employment status",
    };
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      const sample = examples[reason];
      expect(sample, `missing example for ${reason}`).toBeDefined();
      expect(pattern.test(sample!)).toBe(true);
      expect(validateAIResponse(sample!).reason).toBe(reason);
    }
  });

  it("allows clean intake-style replies", () => {
    for (const text of [
      "What's your postal code?",
      "Nice to meet you, Cory!",
      "Got it, and what province are you in?",
      SAFE_FALLBACK_RESPONSE,
    ]) {
      expect(validateAIResponse(text), text).toEqual({ safe: true });
    }
  });
});
