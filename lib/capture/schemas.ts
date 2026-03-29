import { z } from "zod";
import {
  RENEWAL_TIMEFRAMES,
  VERTICAL_MORTGAGE,
} from "@/lib/capture/constants";

/** Canadian province/territory abbreviations for mortgage capture intent (source of truth for UI options). */
export const MORTGAGE_INTENT_PROVINCE_VALUES = [
  "BC",
  "AB",
  "SK",
  "MB",
  "ON",
  "QC",
  "NL",
  "NS",
  "NB",
  "PEI",
  "YT",
  "NT",
  "NU",
  "Other",
] as const;

export type MortgageIntentProvince =
  (typeof MORTGAGE_INTENT_PROVINCE_VALUES)[number];

const digitsOnlyPhone = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .pipe(
    z.string().min(7, { message: "Phone must contain at least 7 digits" }),
  );

const identitySchema = z.object({
  name: z.string().min(1),
  phone: digitsOnlyPhone,
  email: z.email().optional(),
});

const intentMortgageSchema = z.object({
  postal_code: z.string().min(1),
  province: z.enum(MORTGAGE_INTENT_PROVINCE_VALUES, {
    error: (issue) =>
      issue.input === undefined
        ? { message: "Province is required" }
        : { message: "Invalid province" },
  }),
  renewal_timeframe: z.enum(RENEWAL_TIMEFRAMES),
});

const consentSchema = z.object({
  given: z.boolean(),
  policy_version: z.string().min(1),
  timestamp: z.string().datetime(),
});

const attributionSchema = z.object({
  utm_source: z.string().optional(),
  utm_medium: z.string().optional(),
  utm_campaign: z.string().optional(),
  utm_content: z.string().optional(),
  landing_page: z.string().optional(),
});

/** Validated POST /api/capture body for mortgage (export for client-side validation). */
export const captureMortgageRequestSchema = z.object({
  vertical_id: z.literal(VERTICAL_MORTGAGE),
  identity: identitySchema,
  intent: intentMortgageSchema,
  consent: consentSchema,
  attribution: attributionSchema,
});

/** Extensible union: add variants when new verticals ship. */
export const captureRequestSchema = z.discriminatedUnion("vertical_id", [
  captureMortgageRequestSchema,
]);

export type CaptureMortgageRequest = z.infer<typeof captureMortgageRequestSchema>;
export type CaptureRequest = z.infer<typeof captureRequestSchema>;
