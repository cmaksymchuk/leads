"use client";

import type { CaptureAttribution } from "@/lib/capture/attribution";
import { readAttribution } from "@/lib/capture/attribution";
import type { CaptureChatMode } from "@/lib/capture/chat-mode";
import type {
  CaptureStep,
  VerticalCaptureConfig,
} from "@/lib/capture/verticals/types";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useId, useRef, useState } from "react";

export type CaptureChatMessage = {
  id: string;
  role: "bot" | "user";
  text: string;
};

type ChatState =
  | "idle"
  | "typing"
  | "waiting"
  | "submitting"
  | "success"
  | "error";

const TYPING_MS = 800;

function resolveBotText(
  step: CaptureStep,
  data: Record<string, string>,
  messageResolvers: Record<string, (data: Record<string, string>) => string>,
): string {
  const fn = messageResolvers[step.id];
  return fn ? fn(data) : step.botMessage;
}

export type CaptureChatProps = {
  config: VerticalCaptureConfig;
  /** From `useSearchParams()` (client). */
  searchParams: { get(name: string): string | null };
  chatMode: CaptureChatMode;
  validators: Record<string, (value: string) => string | null>;
  messageResolvers: Record<string, (data: Record<string, string>) => string>;
};

export function CaptureChat({
  config,
  searchParams,
  chatMode,
  validators,
  messageResolvers,
}: CaptureChatProps) {
  const idPrefix = useId();
  const msgId = useRef(0);
  const nextMessageId = useCallback(() => {
    msgId.current += 1;
    return `${idPrefix}-${msgId.current}`;
  }, [idPrefix]);

  const [messages, setMessages] = useState<CaptureChatMessage[]>([]);
  const [data, setData] = useState<Record<string, string>>({});
  const [interactionStepIndex, setInteractionStepIndex] = useState(0);
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);

  const dataRef = useRef<Record<string, string>>({});
  /** StrictMode runs effects twice in dev; boot must schedule timers only once per mount. */
  const scriptedBootRef = useRef(false);
  const aiBootRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const steps = config.steps;
  const lastIndex = steps.length - 1;
  const currentStep = steps[interactionStepIndex];

  function showBotForStep(
    stepIndex: number,
    snapshot: Record<string, string>,
  ) {
    setInteractionStepIndex(stepIndex);
    setChatState("typing");
    setInputValue("");
    setInputError(null);
    setLocalError(null);
    window.setTimeout(() => {
      const text = resolveBotText(steps[stepIndex], snapshot, messageResolvers);
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: "bot", text },
      ]);
      setChatState("waiting");
    }, TYPING_MS);
  }

  /** Scripted: defer boot, then typing beat + first bot message. */
  useEffect(() => {
    if (chatMode !== "scripted") return;
    if (scriptedBootRef.current) return;
    scriptedBootRef.current = true;
    let cancelled = false;
    let innerTimer: number | undefined;
    const boot = window.setTimeout(() => {
      if (cancelled) return;
      setChatState("typing");
      setInteractionStepIndex(0);
      innerTimer = window.setTimeout(() => {
        if (cancelled) return;
        const text = resolveBotText(steps[0], {}, messageResolvers);
        setMessages([{ id: nextMessageId(), role: "bot", text }]);
        setChatState("waiting");
      }, TYPING_MS);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      if (innerTimer !== undefined) window.clearTimeout(innerTimer);
    };
  }, [chatMode, messageResolvers, steps, nextMessageId]);

  /** AI mode: deferred boot + POST /api/capture/chat (stub). */
  useEffect(() => {
    if (chatMode !== "ai") return;
    if (aiBootRef.current) return;
    aiBootRef.current = true;
    let cancelled = false;
    let outer: number | undefined;
    const boot = window.setTimeout(() => {
      if (cancelled) return;
      setChatState("typing");
      outer = window.setTimeout(() => {
        void (async () => {
          if (cancelled) return;
          try {
            const res = await fetch("/api/capture/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                verticalSlug: config.slug,
                messages: [] as Array<{ role: string; content: string }>,
              }),
            });
            if (cancelled) return;
            if (!res.ok) {
              setMessages([
                {
                  id: nextMessageId(),
                  role: "bot",
                  text: config.aiModeUnavailableMessage,
                },
              ]);
              setChatState("waiting");
              return;
            }
            setMessages([
              {
                id: nextMessageId(),
                role: "bot",
                text: config.aiModeUnavailableMessage,
              },
            ]);
            setChatState("waiting");
          } catch {
            if (cancelled) return;
            setMessages([
              {
                id: nextMessageId(),
                role: "bot",
                text: config.aiModeUnavailableMessage,
              },
            ]);
            setChatState("waiting");
          }
        })();
      }, TYPING_MS);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(boot);
      if (outer !== undefined) window.clearTimeout(outer);
    };
  }, [chatMode, config.slug, config.aiModeUnavailableMessage, nextMessageId]);

  function advanceAfterAnswer(
    displayText: string,
    field: string,
    storedValue: string,
    answeredStepIndex: number,
  ) {
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: "user", text: displayText },
    ]);
    // Never schedule showBotForStep inside setData's updater — Strict Mode may run
    // that updater twice in dev, which double-queues microtasks and duplicates bot lines.
    const next = { ...dataRef.current, [field]: storedValue };
    dataRef.current = next;
    setData(next);
    if (answeredStepIndex < lastIndex) {
      window.queueMicrotask(() =>
        showBotForStep(answeredStepIndex + 1, next),
      );
    }
    setInputValue("");
  }

  const handleOptionSelect = (label: string) => {
    if (chatMode !== "scripted" || chatState !== "waiting") return;
    const step = steps[interactionStepIndex];
    if (step.type !== "options") return;
    const idx = interactionStepIndex;
    const mapped = step.optionMap?.[label] ?? label;
    advanceAfterAnswer(label, step.field, mapped, idx);
  };

  const handleIntermediateInputSubmit = () => {
    if (chatMode !== "scripted" || chatState !== "waiting") return;
    const step = steps[interactionStepIndex];
    if (step.type !== "input") return;
    const idx = interactionStepIndex;
    if (idx === lastIndex) return;
    const raw = inputValue;
    const err = validators[step.field]?.(raw) ?? null;
    if (err) {
      setInputError(err);
      return;
    }
    setInputError(null);
    advanceAfterAnswer(raw.trim(), step.field, raw.trim(), idx);
  };

  const handleFinalSubmit = async () => {
    if (chatMode !== "scripted") return;
    if (
      interactionStepIndex !== lastIndex ||
      (chatState !== "waiting" && chatState !== "error")
    )
      return;
    const step = steps[lastIndex];
    if (step.type !== "input") return;
    const raw = inputValue;
    const err = validators[step.field]?.(raw) ?? null;
    if (err) {
      setInputError(err);
      return;
    }
    if (!consentChecked) {
      setLocalError(config.consentRequiredMessage);
      return;
    }
    setLocalError(null);
    setInputError(null);

    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: "user", text: raw.trim() },
    ]);
    const nextData = { ...dataRef.current, [step.field]: raw.trim() };
    setData(nextData);
    setInputValue("");
    setChatState("submitting");

    const landingHref =
      typeof window !== "undefined" ? window.location.href : "";
    const attribution: CaptureAttribution = readAttribution(
      searchParams,
      landingHref,
    );

    const body = {
      vertical_id: config.apiVerticalId,
      identity: {
        name: nextData.name,
        phone: nextData.phone.replace(/\D/g, ""),
      },
      intent: {
        postal_code: nextData.postal_code.trim(),
        province: nextData.province,
        renewal_timeframe: nextData.renewal_timeframe,
      },
      consent: {
        given: true,
        policy_version: config.policyVersion,
        timestamp: new Date().toISOString(),
      },
      attribution,
    };

    try {
      const res = await fetch("/api/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success?: boolean };
      if (!res.ok || !json.success) {
        setMessages((prev) => [
          ...prev,
          {
            id: nextMessageId(),
            role: "bot",
            text: config.submissionErrorBotMessage,
          },
        ]);
        setChatState("error");
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: nextMessageId(), role: "bot", text: config.successMessage },
      ]);
      setChatState("success");
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextMessageId(),
          role: "bot",
          text: config.submissionErrorBotMessage,
        },
      ]);
      setChatState("error");
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    if (interactionStepIndex === lastIndex) {
      void handleFinalSubmit();
    } else {
      handleIntermediateInputSubmit();
    }
  };

  const showConsentRow =
    chatMode === "scripted" &&
    interactionStepIndex === lastIndex &&
    (chatState === "waiting" || chatState === "error");

  const showOptions =
    chatMode === "scripted" &&
    currentStep?.type === "options" &&
    chatState === "waiting";

  const showInput =
    chatMode === "scripted" &&
    currentStep?.type === "input" &&
    (chatState === "waiting" || chatState === "error");

  const showProgress = chatMode === "scripted" && chatState !== "idle";

  return (
    <div className="flex flex-col gap-4">
      {showProgress && (
        <div
          className="flex justify-center gap-2 px-2"
          aria-label="Progress"
          role="list"
        >
          {steps.map((s, i) => {
            const success = chatState === "success";
            const submittingAllDone =
              chatState === "submitting" && i <= lastIndex;
            const done =
              success || submittingAllDone || i < interactionStepIndex;
            const current =
              !done &&
              i === interactionStepIndex &&
              (chatState === "waiting" ||
                chatState === "typing" ||
                chatState === "error");
            return (
              <span
                key={s.id}
                role="listitem"
                className={cn(
                  "h-2 w-2 rounded-full transition-colors",
                  done && "bg-emerald-600",
                  current && "bg-blue-600",
                  !done && !current && "bg-zinc-300 dark:bg-zinc-600",
                )}
              />
            );
          })}
        </div>
      )}

      <div className="max-h-[min(420px,55vh)] space-y-3 overflow-y-auto px-1">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              "flex",
              m.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                m.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
              )}
            >
              {m.text}
            </div>
          </div>
        ))}
        {chatState === "typing" && (
          <div className="flex justify-start">
            <div className="bg-zinc-100 dark:bg-zinc-800 flex gap-1 rounded-2xl px-4 py-3">
              <span className="bg-zinc-400 dark:bg-zinc-500 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:0ms]" />
              <span className="bg-zinc-400 dark:bg-zinc-500 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:150ms]" />
              <span className="bg-zinc-400 dark:bg-zinc-500 inline-block h-2 w-2 animate-bounce rounded-full [animation-delay:300ms]" />
            </div>
          </div>
        )}
      </div>

      {showOptions && currentStep.options && (
        <div className="flex flex-wrap gap-2">
          {currentStep.options.map((opt) => (
            <button
              key={opt}
              type="button"
              className="border-border bg-background hover:bg-muted rounded-full border px-3 py-2 text-sm font-medium transition-colors"
              onClick={() => handleOptionSelect(opt)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {showInput && (
        <div className="flex flex-col gap-2">
          {showConsentRow && (
            <label className="text-muted-foreground flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(e) => setConsentChecked(e.target.checked)}
                className="mt-1"
              />
              <span>{config.consentText}</span>
            </label>
          )}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <input
              type={currentStep.inputType ?? "text"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={currentStep.placeholder}
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 rounded-lg border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
              autoComplete={
                currentStep.inputType === "tel"
                  ? "tel"
                  : currentStep.inputType === "email"
                    ? "email"
                    : "name"
              }
            />
            {interactionStepIndex === lastIndex && (
              <button
                type="button"
                onClick={() => void handleFinalSubmit()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 text-sm font-medium"
              >
                {config.submitButtonLabel}
              </button>
            )}
          </div>
          {inputError && (
            <p className="text-destructive text-sm" role="alert">
              {inputError}
            </p>
          )}
          {localError && (
            <p className="text-destructive text-sm" role="alert">
              {localError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
