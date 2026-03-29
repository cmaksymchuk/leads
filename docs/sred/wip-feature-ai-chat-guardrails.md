# SR&ED WIP — feature/ai-chat-guardrails

Branch slug: `feature-ai-chat-guardrails` · Path: `docs/sred/wip-feature-ai-chat-guardrails.md`

## What this branch name tracks

Work on **AI-backed lead capture chat**: server route to Anthropic, **system prompt + server-side output checks** so the assistant stays in “intake only” bounds, **Zod** validation for the chat API body, **capture UI mode** from env (scripted vs ai), tests, and docs. This file is the contemporaneous log for **that** slice.

**Note on git history:** `main..HEAD` on this clone includes a large earlier delta (capture pipeline, processing, CI, etc.). This WIP does **not** re-narrate all of that; it focuses on the **AI chat guardrails** work so commit messages and review stay accurate.

**Project tag (reuse for follow-on commits on this thread):** `CAPTURE-AI-GUARDRAILS-01`

## WIP entries

_(Append new bullets as you work; see `.cursorrules`.)_

## Archived (2026-03-29)

Consumed for commit: AI capture chat guardrails, env mode ADR, SR&ED workflow clarifications, branch WIP + journal link.

- **Env / Turbopack uncertainty (resolved, documented):** I could not rely on dot-notation `process.env.NEXT_PUBLIC_CHAT_MODE` under `next dev` with Turbopack — static replacement could yield `undefined` on the server even with `.env.local` set. **Approach:** read with bracket access in `getCaptureChatModeFromEnv()` and support optional server-only `CAPTURE_CHAT_MODE` overriding the public var. **Evidence:** `lib/capture/chat-mode.ts`, ADR `docs/adr/0002-capture-chat-mode-environment.md`.

- **Guardrail layering:** Prompt constraints from `buildCaptureSystemPrompt(config)` (vertical steps + hard rules + exact fallback phrase) plus **post-response** `validateAIResponse()` regex reasons (`FORBIDDEN_PATTERNS`) on model text before returning to the client. On pattern hit: log `ai_guardrail_triggered`, return 200 JSON with `SAFE_FALLBACK_RESPONSE` and `guardrail_triggered: true`. **Optional field path:** when `current_field` is sent, run vertical field validators on the last user message; on failure, same fallback shape. **Evidence:** `app/api/capture/chat/route.ts`, `lib/capture/ai/response-validator.ts`, `lib/capture/ai/system-prompt.ts`.

- **External input:** `captureChatBodySchema` in `lib/validation/capture-chat.ts` — messages + `vertical_id` with `unknown_vertical_id` for bad ids. Route uses `withMonitoring`, flow `lead-capture`. Model: `claude-haiku-4-5-20251001`, `max_tokens: 150`, `ANTHROPIC_API_KEY` required.

- **Not recorded in WIP:** Contemporaneous notes for rejected prompt variants, false positive/negative rates on `FORBIDDEN_PATTERNS`, or A/B vs gateway routing — those were not captured at implementation time in repo artifacts.
