/** Serializable step shape for server → client props (no functions). */
export interface CaptureStep {
  id: string;
  botMessage: string;
  type: "options" | "input";
  inputType?: "text" | "tel" | "email";
  placeholder?: string;
  options?: string[];
  optionMap?: Record<string, string>;
  field: string;
}

/** Full vertical step definition (validators live only in vertical modules + client resolvers). */
export interface CaptureStepWithValidation extends CaptureStep {
  validate?: (value: string) => string | null;
}

export interface VerticalCaptureConfig {
  slug: string;
  /** Prominent disclosure above the chat (AI and scripted). */
  disclosure: string;
  title: string;
  /** Small line above headline (optional). */
  eyebrow?: string;
  headline: string;
  headlineAccent: string;
  subhead: string;
  trustItems: string[];
  steps: CaptureStep[];
  apiVerticalId: string;
  consentText: string;
  policyVersion: string;
  successMessage: string;
  /** Shown when POST /api/capture fails; user can retry. */
  submissionErrorBotMessage: string;
  /** Shown when capture chat mode is `ai` and the chat API is not ready. */
  aiModeUnavailableMessage: string;
  /** Chat card header line (e.g. assistant name). */
  chatCardTitle: string;
  /** Short label inside the avatar circle (2–3 characters). */
  chatAvatarLabel: string;
  onlineStatusText: string;
  /** Primary button on final step. */
  submitButtonLabel: string;
  /** Checkbox validation when user tries to submit without consent. */
  consentRequiredMessage: string;
}
