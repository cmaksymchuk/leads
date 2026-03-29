import { getCaptureChatModeFromEnv } from "@/lib/capture/chat-mode";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("getCaptureChatModeFromEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("defaults to scripted when unset", () => {
    vi.stubEnv("CAPTURE_CHAT_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", "");
    expect(getCaptureChatModeFromEnv()).toBe("scripted");
  });

  it("returns ai when NEXT_PUBLIC_CHAT_MODE is ai", () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", "ai");
    expect(getCaptureChatModeFromEnv()).toBe("ai");
  });

  it("trims NEXT_PUBLIC_CHAT_MODE", () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", " ai ");
    expect(getCaptureChatModeFromEnv()).toBe("ai");
  });

  it("returns scripted for other NEXT_PUBLIC_CHAT_MODE values", () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", "scripted");
    expect(getCaptureChatModeFromEnv()).toBe("scripted");
  });

  it("CAPTURE_CHAT_MODE overrides NEXT_PUBLIC_CHAT_MODE", () => {
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", "scripted");
    vi.stubEnv("CAPTURE_CHAT_MODE", "ai");
    expect(getCaptureChatModeFromEnv()).toBe("ai");
  });

  it("uses NEXT_PUBLIC_CHAT_MODE when CAPTURE_CHAT_MODE is empty", () => {
    vi.stubEnv("CAPTURE_CHAT_MODE", "");
    vi.stubEnv("NEXT_PUBLIC_CHAT_MODE", "ai");
    expect(getCaptureChatModeFromEnv()).toBe("ai");
  });
});
