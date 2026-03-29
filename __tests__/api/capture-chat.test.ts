import { POST } from "@/app/api/capture/chat/route";
import { logger } from "@/lib/api";
import { SAFE_FALLBACK_RESPONSE } from "@/lib/capture/ai/response-validator";
import { VERTICAL_MORTGAGE } from "@/lib/capture/constants";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const USER_SECRET = "UNIQUE_USER_CONTENT_FOR_LOGGING_TEST";

function mockAnthropicResponse(text: string, status = 200) {
  return new Response(
    JSON.stringify({
      content: [{ type: "text", text }],
    }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}

describe("POST /api/capture/chat", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      mockAnthropicResponse("What's your postal code?"),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.ANTHROPIC_API_KEY = originalKey;
  });

  it("returns 200 with assistant text when Anthropic returns safe content", async () => {
    const req = new NextRequest("http://localhost/api/capture/chat", {
      method: "POST",
      body: JSON.stringify({
        vertical_id: VERTICAL_MORTGAGE,
        messages: [{ role: "user", content: "Hello" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { response: string };
    expect(body.response).toBe("What's your postal code?");
  });

  it("returns fallback and guardrail_triggered when response matches forbidden patterns", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      mockAnthropicResponse("Rates are around 5.5% right now."),
    );
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/api/capture/chat", {
      method: "POST",
      body: JSON.stringify({
        vertical_id: VERTICAL_MORTGAGE,
        messages: [
          { role: "user", content: USER_SECRET },
          { role: "assistant", content: "Hi" },
        ],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      response: string;
      guardrail_triggered?: boolean;
    };
    expect(body.response).toBe(SAFE_FALLBACK_RESPONSE);
    expect(body.guardrail_triggered).toBe(true);

    expect(warnSpy).toHaveBeenCalled();
    const logged = JSON.stringify(warnSpy.mock.calls);
    expect(logged).not.toContain(USER_SECRET);
  });

  it("returns 400 for unknown vertical_id", async () => {
    const req = new NextRequest("http://localhost/api/capture/chat", {
      method: "POST",
      body: JSON.stringify({
        vertical_id: "insurance",
        messages: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("unknown_vertical_id");
  });

  it("returns 500 when Anthropic HTTP response is not ok", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("", { status: 529 }),
    );
    vi.spyOn(logger, "error").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/api/capture/chat", {
      method: "POST",
      body: JSON.stringify({
        vertical_id: VERTICAL_MORTGAGE,
        messages: [],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("returns fallback when current_field value fails vertical validators", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () =>
      mockAnthropicResponse("Thanks! I've noted that."),
    );
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const req = new NextRequest("http://localhost/api/capture/chat", {
      method: "POST",
      body: JSON.stringify({
        vertical_id: VERTICAL_MORTGAGE,
        messages: [{ role: "user", content: "not-a-postal" }],
        current_field: "postal_code",
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      response: string;
      guardrail_triggered?: boolean;
    };
    expect(body.response).toBe(SAFE_FALLBACK_RESPONSE);
    expect(body.guardrail_triggered).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    const fieldCall = warnSpy.mock.calls.find(
      (c) => c[1]?.event === "ai_field_validation_failed",
    );
    expect(fieldCall).toBeDefined();
  });
});
