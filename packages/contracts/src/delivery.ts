import { z } from "zod";

import {
  applicationIdSchema,
  branchIdSchema,
  eventIdSchema,
  installationIdSchema,
  routeKeySchema,
  tenantIdSchema,
  utcDateTimeSchema,
  visitTokenSchema,
} from "./primitives.js";

const base64Schema = z
  .string()
  .min(4)
  .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/);
const gcmIvSchema = z.string().regex(/^[A-Za-z0-9+/]{16}$/, "Expected a 12-byte GCM IV");
const gcmAuthTagSchema = z
  .string()
  .regex(/^[A-Za-z0-9+/]{22}==$/, "Expected a 16-byte GCM authentication tag");
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);

export const encryptedPayloadSchema = z
  .object({
    algorithm: z.literal("AES-256-GCM"),
    ciphertext: base64Schema,
    iv: gcmIvSchema,
    authTag: gcmAuthTagSchema,
    encryptedDataKey: base64Schema,
    keyId: z.string().min(1).max(128),
  })
  .strict();

function decodedBase64Length(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return (value.length / 4) * 3 - padding;
}

export const deliveryEnvelopeSchema = z
  .object({
    eventId: eventIdSchema,
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    anonymousInstallationId: installationIdSchema,
    visitToken: visitTokenSchema,
    branchId: branchIdSchema,
    routeKey: routeKeySchema,
    encryptedPayload: encryptedPayloadSchema,
    payloadHash: sha256Schema,
    payloadSizeBytes: z.number().int().positive().max(1_048_576),
    createdAt: utcDateTimeSchema,
    expiresAt: utcDateTimeSchema,
  })
  .strict()
  .superRefine((envelope, context) => {
    if (Date.parse(envelope.expiresAt) <= Date.parse(envelope.createdAt)) {
      context.addIssue({
        code: "custom",
        message: "Delivery envelope must expire after it is created",
        path: ["expiresAt"],
      });
    }
    if (decodedBase64Length(envelope.encryptedPayload.ciphertext) !== envelope.payloadSizeBytes) {
      context.addIssue({
        code: "custom",
        message: "Payload size must match the decoded ciphertext size",
        path: ["payloadSizeBytes"],
      });
    }
  });

export const deliveryStateSchema = z.enum([
  "ACCEPTED",
  "VALIDATED",
  "QUEUED",
  "DELIVERING",
  "RETRYING",
  "DELIVERED",
  "FAILED",
  "EXPIRED",
  "DEAD_LETTERED",
]);

export const deliveryReceiptSchema = z
  .object({
    eventId: eventIdSchema,
    tenantId: tenantIdSchema,
    destinationId: z.string().min(1).max(128),
    state: deliveryStateSchema,
    attemptCount: z.number().int().nonnegative(),
    acceptedAt: utcDateTimeSchema,
    deliveredAt: utcDateTimeSchema.nullable(),
    receiverReference: z.string().max(256).nullable(),
    latencyMilliseconds: z.number().int().nonnegative().nullable(),
  })
  .strict()
  .superRefine((receipt, context) => {
    const delivered = receipt.state === "DELIVERED";
    if (delivered !== (receipt.deliveredAt !== null)) {
      context.addIssue({
        code: "custom",
        message: "Delivered receipts require deliveredAt and other states must omit it",
        path: ["deliveredAt"],
      });
    }
    if (delivered !== (receipt.latencyMilliseconds !== null)) {
      context.addIssue({
        code: "custom",
        message: "Delivered receipts require latency and other states must omit it",
        path: ["latencyMilliseconds"],
      });
    }
  });

export type EncryptedPayload = z.infer<typeof encryptedPayloadSchema>;
export type DeliveryEnvelope = z.infer<typeof deliveryEnvelopeSchema>;
export type DeliveryState = z.infer<typeof deliveryStateSchema>;
export type DeliveryReceipt = z.infer<typeof deliveryReceiptSchema>;
