export const FORBIDDEN_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\d+(\.\d+)?\s*%/, reason: "percentage_mentioned" },
  { pattern: /\$[\d,]+/, reason: "dollar_amount_mentioned" },
  {
    pattern: /prime rate|variable rate|fixed rate|posted rate/i,
    reason: "rate_type_mentioned",
  },
  {
    pattern: /bank of canada|federal reserve|BoC/i,
    reason: "central_bank_mentioned",
  },
  {
    pattern:
      /\b(TD|RBC|Scotiabank|Scotia|BMO|CIBC|National Bank|HSBC|Wells Fargo|Chase|Rocket Mortgage|Quicken)\b/i,
    reason: "lender_mentioned",
  },
  {
    pattern: /you should|i recommend|i'd recommend|i suggest|i would|my advice/i,
    reason: "advice_given",
  },
  {
    pattern: /rate is (high|low|good|bad|great|terrible)/i,
    reason: "rate_opinion_given",
  },
  {
    pattern: /payment (will|would|could|might|should)/i,
    reason: "payment_projection_given",
  },
  {
    pattern: /lock in|go variable|refinance|break your mortgage/i,
    reason: "course_of_action_recommended",
  },
  {
    pattern: /income|employment|sin\b|social security|net worth/i,
    reason: "financial_pii_requested",
  },
];

export const SAFE_FALLBACK_RESPONSE =
  "That's a great question for your broker — they'll go over all of that with you. Let me make sure I get your info to the right person.";

export function validateAIResponse(text: string): { safe: boolean; reason?: string } {
  for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
    if (pattern.test(text)) {
      return { safe: false, reason };
    }
  }
  return { safe: true };
}
