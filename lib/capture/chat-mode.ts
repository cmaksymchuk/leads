export type CaptureChatMode = "scripted" | "ai";

/**
 * NEXT_PUBLIC_CHAT_MODE: "scripted" (default) | "ai"
 * When "ai", CaptureChat calls POST /api/capture/chat (see route contract there).
 */
export function getCaptureChatModeFromEnv(): CaptureChatMode {
  const raw = process.env.NEXT_PUBLIC_CHAT_MODE;
  if (raw === "ai") return "ai";
  return "scripted";
}
