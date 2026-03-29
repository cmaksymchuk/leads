import {
  CAPTURE_DISCLOSURE,
  CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";
import { MORTGAGE_INTENT_PROVINCE_VALUES } from "@/lib/capture/schemas";
import type {
  CaptureStep,
  CaptureStepWithValidation,
  VerticalCaptureConfig,
} from "@/lib/capture/verticals/types";

const POSTAL_PATTERN = /^[A-Za-z]\d[A-Za-z][\s-]?\d[A-Za-z]\d$/;

function validateName(value: string): string | null {
  return value.trim().length >= 1 ? null : "Please enter your name.";
}

function validatePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 7 ? null : "Enter at least 7 digits.";
}

function validatePostal(value: string): string | null {
  const t = value.trim();
  return POSTAL_PATTERN.test(t) ? null : "Enter a valid Canadian postal code.";
}

/** Field → validate (client-only; not passed from server). */
export const mortgageFieldValidators: Record<
  string,
  (value: string) => string | null
> = {
  name: validateName,
  phone: validatePhone,
  postal_code: validatePostal,
};

/** Step id → dynamic bot message (client-only). */
export const mortgageMessageResolversByStepId: Record<
  string,
  (data: Record<string, string>) => string
> = {
  phone: (data) =>
    `Nice to meet you, ${data.name ?? "there"}! What's the best number to reach you?`,
};

const mortgageStepsWithValidation: CaptureStepWithValidation[] = [
  {
    id: "renewal_timeframe",
    botMessage: "Hi! When does your mortgage come up for renewal?",
    type: "options",
    field: "renewal_timeframe",
    options: [
      "Within 6 months",
      "6–12 months",
      "More than a year",
      "Not sure",
    ],
    optionMap: {
      "Within 6 months": "0-6mo",
      "6–12 months": "6-12mo",
      "More than a year": "12mo+",
      "Not sure": "12mo+",
    },
  },
  {
    id: "province",
    botMessage: "Got it. And what province are you in?",
    type: "options",
    field: "province",
    options: [...MORTGAGE_INTENT_PROVINCE_VALUES],
  },
  {
    id: "name",
    botMessage: "Perfect. What's your name?",
    type: "input",
    inputType: "text",
    placeholder: "Your name",
    field: "name",
    validate: validateName,
  },
  {
    id: "phone",
    botMessage:
      "Nice to meet you! What's the best number to reach you?",
    type: "input",
    inputType: "tel",
    placeholder: "Phone number",
    field: "phone",
    validate: validatePhone,
  },
  {
    id: "postal_code",
    botMessage:
      "Last one — what's your postal code? This helps us find brokers near you.",
    type: "input",
    inputType: "text",
    placeholder: "e.g. M5V 2T6",
    field: "postal_code",
    validate: validatePostal,
  },
];

function toSerializableSteps(
  steps: CaptureStepWithValidation[],
): CaptureStep[] {
  return steps.map((s) => {
    const { validate: _omit, ...rest } = s;
    void _omit;
    return rest;
  });
}

export const mortgageCaptureConfig: VerticalCaptureConfig = {
  slug: "mortgage",
  disclosure: CAPTURE_DISCLOSURE,
  title: "Mortgage renewal — get your best rate",
  eyebrow: "Licensed broker network",
  headline: "Your mortgage is renewing.",
  headlineAccent: "Are you getting the best rate?",
  subhead:
    "Tell us a bit about your situation and we'll connect you with a licensed broker who shops the market for you — at no cost.",
  trustItems: [
    "Licensed brokers only",
    "No obligation",
    "Your info stays private",
  ],
  apiVerticalId: VERTICAL_MORTGAGE,
  consentText:
    "By submitting, you agree to be contacted by a licensed mortgage broker.",
  policyVersion: CAPTURE_POLICY_VERSION_MORTGAGE_V1,
  successMessage:
    "You're all set! A licensed broker will reach out to you shortly. They'll shop multiple lenders to find your best rate — no cost, no obligation.",
  submissionErrorBotMessage:
    "Something went wrong — please try again or call us directly.",
  aiModeUnavailableMessage:
    "AI-assisted chat is not available yet. Please refresh with the standard experience or try again later.",
  chatCardTitle: "Broker desk",
  chatAvatarLabel: "MB",
  onlineStatusText: "Online now",
  submitButtonLabel: "Submit",
  consentRequiredMessage: "Please confirm consent to continue.",
  steps: toSerializableSteps(mortgageStepsWithValidation),
};
