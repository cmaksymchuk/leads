export type CaptureChatMode = "scripted" | "ai";

/**
 * Resolve capture UI mode from env.
 *
 * Use bracket notation for `NEXT_PUBLIC_*` so the dev bundler reads runtime
 * `process.env` (dot access can be statically replaced with `undefined` before
 * `.env.local` is applied).
 *
 * Optional `CAPTURE_CHAT_MODE` (server-only) overrides `NEXT_PUBLIC_CHAT_MODE`
 * when both are set.
 */
export function getCaptureChatModeFromEnv(): CaptureChatMode {
  const serverRaw = process.env["CAPTURE_CHAT_MODE"];
  const publicRaw = process.env["NEXT_PUBLIC_CHAT_MODE"];
  const raw =
    typeof serverRaw === "string" && serverRaw.trim() !== ""
      ? serverRaw.trim()
      : typeof publicRaw === "string"
        ? publicRaw.trim()
        : "";
  if (raw === "ai") return "ai";
  return "scripted";
}
