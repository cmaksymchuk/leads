# ADR-0002: Capture chat mode — server env and Turbopack

Date: 2026-03-29
Status: Accepted

## Context
Lead capture can run as a fixed step flow (`scripted`) or as AI-backed chat (`ai`). Mode is chosen from environment variables on the server and passed into the client as props.

Under `next dev` with Turbopack, reading `process.env.NEXT_PUBLIC_CHAT_MODE` with dot notation can be statically replaced so the server sees `undefined` even when `.env.local` sets the variable.

## Decision
1. Resolve mode in `getCaptureChatModeFromEnv()` using **bracket access** (`process.env["NEXT_PUBLIC_CHAT_MODE"]`) so the value is read at runtime.
2. Support optional **`CAPTURE_CHAT_MODE`** (server-only). When non-empty, it overrides `NEXT_PUBLIC_CHAT_MODE` for server-side resolution. Document both in `docs/env-vars.md` and `.env.example`.

## Consequences
- Local dev can rely on `CAPTURE_CHAT_MODE=ai` without depending on `NEXT_PUBLIC_*` inlining behavior.
- Production and preview should set at least one of these vars if AI capture is desired; `CAPTURE_CHAT_MODE` avoids exposing the knob to the client bundle if only the server needs it (mode is still passed as a prop today).
