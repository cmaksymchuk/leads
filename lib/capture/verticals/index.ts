import {
  mortgageCaptureConfig,
  mortgageFieldValidators,
  mortgageMessageResolversByStepId,
} from "@/lib/capture/verticals/mortgage";
import type { VerticalCaptureConfig } from "@/lib/capture/verticals/types";

export type {
  CaptureStep,
  CaptureStepWithValidation,
  VerticalCaptureConfig,
} from "@/lib/capture/verticals/types";

const registry: Record<string, VerticalCaptureConfig> = {
  [mortgageCaptureConfig.slug]: mortgageCaptureConfig,
};

export function getVerticalConfig(slug: string): VerticalCaptureConfig | null {
  return registry[slug] ?? null;
}

export function getVerticalValidators(
  slug: string,
): Record<string, (value: string) => string | null> {
  if (slug === mortgageCaptureConfig.slug) {
    return { ...mortgageFieldValidators };
  }
  return {};
}

export function getVerticalMessageResolvers(
  slug: string,
): Record<string, (data: Record<string, string>) => string> {
  if (slug === mortgageCaptureConfig.slug) {
    return { ...mortgageMessageResolversByStepId };
  }
  return {};
}
