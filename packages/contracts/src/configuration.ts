import { z } from "zod";

import {
  applicationIdSchema,
  ed25519SignatureSchema,
  tenantIdSchema,
  utcDateTimeSchema,
} from "./primitives.js";

export const visitStartPolicySchema = z.enum([
  "CUSTOMER_CONFIRMED",
  "DWELL_CONFIRMED",
  "HOST_APP_CONFIRMED",
]);
export const visitEndPolicySchema = z.enum([
  "STABLE_GEOFENCE_EXIT",
  "MANUAL_EXIT",
  "MAX_DURATION",
  "HOST_APP_EXIT",
]);

export const geofencePolicySchema = z
  .object({
    approachRadiusMeters: z.number().int().positive().max(100_000),
    visitRadiusMeters: z.number().int().positive().max(100_000),
    exitRadiusMeters: z.number().int().positive().max(100_000),
    exitGraceSeconds: z.number().int().nonnegative().max(86_400),
    notNowCooldownSeconds: z.number().int().nonnegative().max(604_800),
    notVisitingCooldownSeconds: z.number().int().nonnegative().max(2_592_000),
    maximumVisitDurationSeconds: z.number().int().positive().max(604_800),
    minimumAccuracyMeters: z.number().finite().positive().max(100_000),
    startPolicy: visitStartPolicySchema,
    endPolicy: visitEndPolicySchema,
  })
  .strict()
  .superRefine((policy, context) => {
    if (policy.exitRadiusMeters < policy.visitRadiusMeters) {
      context.addIssue({
        code: "custom",
        message: "Exit radius must be greater than or equal to visit radius",
        path: ["exitRadiusMeters"],
      });
    }
    if (policy.approachRadiusMeters < policy.exitRadiusMeters) {
      context.addIssue({
        code: "custom",
        message: "Approach radius must be greater than or equal to exit radius",
        path: ["approachRadiusMeters"],
      });
    }
  });

export const notificationTemplateSchema = z
  .object({
    locale: z.string().min(2).max(35),
    title: z.string().min(1).max(128),
    body: z.string().min(1).max(512),
    sound: z.boolean(),
    vibration: z.boolean(),
    version: z.string().min(1).max(128),
  })
  .strict();

export const publicConfigurationSchema = z
  .object({
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    version: z.string().min(1).max(128),
    publishedAt: utcDateTimeSchema,
    policy: geofencePolicySchema,
    notification: notificationTemplateSchema,
  })
  .strict();

export const signedConfigurationSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    keyId: z.string().min(1).max(128),
    payload: publicConfigurationSchema,
    signature: ed25519SignatureSchema,
  })
  .strict();

export type GeofencePolicy = z.infer<typeof geofencePolicySchema>;
export type NotificationTemplate = z.infer<typeof notificationTemplateSchema>;
export type PublicConfiguration = z.infer<typeof publicConfigurationSchema>;
export type SignedConfiguration = z.infer<typeof signedConfigurationSchema>;
