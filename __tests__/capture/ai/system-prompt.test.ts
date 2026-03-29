import { SAFE_FALLBACK_RESPONSE } from "@/lib/capture/ai/response-validator";
import { buildCaptureSystemPrompt } from "@/lib/capture/ai/system-prompt";
import { mortgageCaptureConfig } from "@/lib/capture/verticals/mortgage";
import { describe, expect, it } from "vitest";

describe("buildCaptureSystemPrompt", () => {
  it("includes human collection lines for every mortgage step field", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    expect(prompt).toContain("When their mortgage renews");
    expect(prompt).toContain("What province or state they are in");
    expect(prompt).toContain("Their first name");
    expect(prompt).toContain("Their phone number");
    expect(prompt).toContain("Their postal or zip code");
  });

  it("embeds the exact SAFE_FALLBACK_RESPONSE phrase", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    expect(prompt).toContain(SAFE_FALLBACK_RESPONSE);
  });

  it("states the assistant is not a mortgage broker", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    expect(prompt).toMatch(/not a mortgage broker/i);
  });

  it("includes Never rules for each hard-rule category", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    const categories = [
      /Never quote.*interest rates/i,
      /Never quote.*monthly payments/i,
      /Never compare lenders/i,
      /Never recommend a course of action/i,
      /Never give an opinion on whether a rate/i,
      /Never discuss what a broker/i,
      /Never answer questions about the mortgage market/i,
      /Never collect SIN/i,
      /Never collect current interest rate/i,
      /Never act as.*mortgage broker/i,
      /Never give legal or financial advice/i,
      /Never mention specific lenders by name/i,
      /Never mention the Bank of Canada/i,
      /Never use percentages, dollar amounts/i,
    ];
    for (const re of categories) {
      expect(prompt).toMatch(re);
    }
  });

  it("numbered field count matches config.steps.length", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    const lines = prompt.split("\n").filter((line) => /^\d+\.\s/.test(line.trim()));
    expect(lines.length).toBe(mortgageCaptureConfig.steps.length);
  });

  it("uses dynamic field count in the IF ASKED paragraph", () => {
    const prompt = buildCaptureSystemPrompt(mortgageCaptureConfig);
    expect(prompt).toContain(
      `the ${mortgageCaptureConfig.steps.length} fields listed above`,
    );
  });
});
