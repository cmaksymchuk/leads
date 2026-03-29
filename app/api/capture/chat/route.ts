import {
  apiErrorJson,
  apiJson,
  logger,
  type MonitoringContext,
  withMonitoring,
} from "@/lib/api";
import { SAFE_FALLBACK_RESPONSE, validateAIResponse } from "@/lib/capture/ai/response-validator";
import { buildCaptureSystemPrompt } from "@/lib/capture/ai/system-prompt";
import {
  CAPTURE_ERROR_INVALID_JSON,
  CAPTURE_ERROR_UNKNOWN_VERTICAL_ID,
  CAPTURE_ERROR_VALIDATION,
  CAPTURE_RESPONSE_INTERNAL_ERROR,
} from "@/lib/capture/constants";
import {
  getVerticalCaptureConfigByApiVerticalId,
  getVerticalValidators,
} from "@/lib/capture/verticals";
import { captureChatBodySchema } from "@/lib/validation/capture-chat";
import { NextRequest } from "next/server";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const CAPTURE_CHAT_MODEL = "claude-haiku-4-5-20251001";

function extractAnthropicAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (
      block &&
      typeof block === "object" &&
      (block as { type?: string }).type === "text" &&
      "text" in block
    ) {
      return String((block as { text: string }).text);
    }
  }
  return "";
}

function lastUserMessageContent(
  messages: { role: string; content: string }[],
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return undefined;
}

async function handlePost(req: NextRequest, ctx: MonitoringContext) {
  const { requestId } = ctx;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiErrorJson({ error: CAPTURE_ERROR_INVALID_JSON }, 400, requestId);
  }

  const parsed = captureChatBodySchema.safeParse(json);
  if (!parsed.success) {
    const unknownVertical = parsed.error.issues.some(
      (i) => i.message === "unknown_vertical_id",
    );
    return apiErrorJson(
      {
        error: unknownVertical
          ? CAPTURE_ERROR_UNKNOWN_VERTICAL_ID
          : CAPTURE_ERROR_VALIDATION,
        details: parsed.error.flatten(),
      },
      400,
      requestId,
    );
  }

  const body = parsed.data;
  const config = getVerticalCaptureConfigByApiVerticalId(body.vertical_id);
  if (!config) {
    return apiErrorJson(
      { error: CAPTURE_ERROR_UNKNOWN_VERTICAL_ID },
      400,
      requestId,
    );
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    logger.error("capture_chat_missing_anthropic_key", {
      event: "capture_chat_missing_anthropic_key",
      vertical_id: body.vertical_id,
    });
    return apiErrorJson(
      { error: CAPTURE_RESPONSE_INTERNAL_ERROR },
      500,
      requestId,
    );
  }

  const systemPrompt = buildCaptureSystemPrompt(config);

  let anthropicRes: Response;
  try {
    anthropicRes = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CAPTURE_CHAT_MODEL,
        max_tokens: 150,
        system: systemPrompt,
        messages: body.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });
  } catch (e) {
    logger.error("capture_chat_anthropic_fetch_failed", {
      event: "capture_chat_anthropic_fetch_failed",
      vertical_id: body.vertical_id,
      error: e instanceof Error ? e.message : String(e),
    });
    return apiErrorJson(
      { error: CAPTURE_RESPONSE_INTERNAL_ERROR },
      500,
      requestId,
    );
  }

  if (!anthropicRes.ok) {
    logger.error("capture_chat_anthropic_http_error", {
      event: "capture_chat_anthropic_http_error",
      vertical_id: body.vertical_id,
      status: anthropicRes.status,
    });
    return apiErrorJson(
      { error: CAPTURE_RESPONSE_INTERNAL_ERROR },
      500,
      requestId,
    );
  }

  let anthropicJson: unknown;
  try {
    anthropicJson = await anthropicRes.json();
  } catch (e) {
    logger.error("capture_chat_anthropic_json_failed", {
      event: "capture_chat_anthropic_json_failed",
      vertical_id: body.vertical_id,
      error: e instanceof Error ? e.message : String(e),
    });
    return apiErrorJson(
      { error: CAPTURE_RESPONSE_INTERNAL_ERROR },
      500,
      requestId,
    );
  }

  const text = extractAnthropicAssistantText(anthropicJson).trim();
  if (!text) {
    logger.error("capture_chat_empty_assistant_text", {
      event: "capture_chat_empty_assistant_text",
      vertical_id: body.vertical_id,
    });
    return apiErrorJson(
      { error: CAPTURE_RESPONSE_INTERNAL_ERROR },
      500,
      requestId,
    );
  }

  const patternCheck = validateAIResponse(text);
  if (!patternCheck.safe) {
    logger.warn("ai_guardrail_triggered", {
      event: "ai_guardrail_triggered",
      reason: patternCheck.reason,
      vertical_id: body.vertical_id,
      current_field: body.current_field ?? null,
    });
    return apiJson(
      {
        response: SAFE_FALLBACK_RESPONSE,
        guardrail_triggered: true,
      },
      200,
      requestId,
    );
  }

  if (body.current_field) {
    const validators = getVerticalValidators(config.slug);
    const validateField = validators[body.current_field];
    const lastUser = lastUserMessageContent(body.messages);
    if (validateField && lastUser !== undefined && lastUser.trim() !== "") {
      const fieldErr = validateField(lastUser);
      if (fieldErr !== null) {
        logger.warn("ai_field_validation_failed", {
          event: "ai_field_validation_failed",
          vertical_id: body.vertical_id,
          current_field: body.current_field,
        });
        return apiJson(
          {
            response: SAFE_FALLBACK_RESPONSE,
            guardrail_triggered: true,
          },
          200,
          requestId,
        );
      }
    }
  }

  return apiJson({ response: text }, 200, requestId);
}

export const POST = withMonitoring(handlePost, {
  route: "/api/capture/chat",
  flow: "lead-capture",
});
