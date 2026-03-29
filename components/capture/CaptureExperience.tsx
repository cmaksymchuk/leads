"use client";

import { CaptureChat } from "@/components/capture/CaptureChat";
import type { CaptureChatMode } from "@/lib/capture/chat-mode";
import {
  getVerticalMessageResolvers,
  getVerticalValidators,
} from "@/lib/capture/verticals";
import type { VerticalCaptureConfig } from "@/lib/capture/verticals/types";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

export function CaptureExperience({
  config,
  chatMode,
}: {
  config: VerticalCaptureConfig;
  chatMode: CaptureChatMode;
}) {
  const searchParams = useSearchParams();
  const validators = useMemo(
    () => getVerticalValidators(config.slug),
    [config.slug],
  );
  const messageResolvers = useMemo(
    () => getVerticalMessageResolvers(config.slug),
    [config.slug],
  );
  return (
    <CaptureChat
      config={config}
      searchParams={searchParams}
      chatMode={chatMode}
      validators={validators}
      messageResolvers={messageResolvers}
    />
  );
}
