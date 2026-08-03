import { z } from "zod";

import {
  applicationIdSchema,
  correlationIdSchema,
  ed25519SignatureSchema,
  eventIdSchema,
  tenantIdSchema,
  utcDateTimeSchema,
} from "./primitives.js";

export const fallbackChannelSchema = z.literal("SMS");
export const fallbackCommandSchema = z.enum([
  "CONFIRM_VISIT",
  "SNOOZE_VISIT",
  "DECLINE_VISIT",
  "REQUEST_CALLBACK",
]);
export const fallbackReasonSchema = z.enum([
  "NO_DATA_CONNECTION",
  "PUSH_UNAVAILABLE",
  "CONTROL_API_UNAVAILABLE",
  "PRIMARY_TIMEOUT",
  "MANUAL_SELECTION",
]);

export const normalizedFallbackCommandSchema = z
  .object({
    commandId: eventIdSchema,
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    correlationId: correlationIdSchema,
    channel: fallbackChannelSchema,
    reason: fallbackReasonSchema,
    command: fallbackCommandSchema,
    occurredAt: utcDateTimeSchema,
    expiresAt: utcDateTimeSchema,
  })
  .strict()
  .refine((command) => Date.parse(command.expiresAt) > Date.parse(command.occurredAt), {
    message: "Fallback command must expire after it occurs",
    path: ["expiresAt"],
  });

export const signedFallbackCommandSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    keyId: z.string().min(1).max(128),
    payload: normalizedFallbackCommandSchema,
    signature: ed25519SignatureSchema,
  })
  .strict();

export const fallbackCommandReceiptSchema = z
  .object({
    commandId: eventIdSchema,
    tenantId: tenantIdSchema,
    correlationId: correlationIdSchema,
    status: z.enum(["ACCEPTED", "DUPLICATE", "REJECTED", "EXPIRED"]),
    receivedAt: utcDateTimeSchema,
    processedAt: utcDateTimeSchema,
  })
  .strict()
  .refine((receipt) => Date.parse(receipt.processedAt) >= Date.parse(receipt.receivedAt), {
    message: "Fallback command cannot be processed before receipt",
    path: ["processedAt"],
  });

export type FallbackChannel = z.infer<typeof fallbackChannelSchema>;
export type FallbackCommand = z.infer<typeof fallbackCommandSchema>;
export type FallbackReason = z.infer<typeof fallbackReasonSchema>;
export type NormalizedFallbackCommand = z.infer<typeof normalizedFallbackCommandSchema>;
export type SignedFallbackCommand = z.infer<typeof signedFallbackCommandSchema>;
export type FallbackCommandReceipt = z.infer<typeof fallbackCommandReceiptSchema>;
