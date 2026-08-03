import { z } from "zod";

import {
  applicationIdSchema,
  branchIdSchema,
  eventIdSchema,
  installationIdSchema,
  tenantIdSchema,
  utcDateTimeSchema,
  visitTokenSchema,
} from "./primitives.js";

export const measurementConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW", "EXCLUDED"]);
export const visitStartSourceSchema = z.enum([
  "CUSTOMER_CONFIRMED",
  "DWELL_CONFIRMED",
  "HOST_APP_CONFIRMED",
]);
export const visitCompletionSourceSchema = z.enum([
  "GEOFENCE_EXIT",
  "MANUAL_EXIT",
  "HOST_APP_EXIT",
]);
export const visitEndSourceSchema = z.enum([
  ...visitCompletionSourceSchema.options,
  "MAX_DURATION",
  "CONSENT_REVOKED",
]);

const visitEventBaseSchema = z
  .object({
    eventId: eventIdSchema,
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    anonymousInstallationId: installationIdSchema,
    branchId: branchIdSchema,
    visitToken: visitTokenSchema,
    occurredAt: utcDateTimeSchema,
    configurationVersion: z.string().min(1).max(128),
    demo: z.boolean(),
  })
  .strict();

interface EndedVisitTiming {
  durationSeconds: number;
  endedAt: string;
  occurredAt: string;
  startedAt: string;
}

function validateEndedVisit(event: EndedVisitTiming, context: z.RefinementCtx): void {
  const startedAt = Date.parse(event.startedAt);
  const endedAt = Date.parse(event.endedAt);
  const expectedDuration = Math.floor((endedAt - startedAt) / 1_000);

  if (endedAt < startedAt) {
    context.addIssue({
      code: "custom",
      message: "Visit cannot end before it starts",
      path: ["endedAt"],
    });
  } else if (event.durationSeconds !== expectedDuration) {
    context.addIssue({
      code: "custom",
      message: "Visit duration must match startedAt and endedAt",
      path: ["durationSeconds"],
    });
  }

  if (Date.parse(event.occurredAt) < endedAt) {
    context.addIssue({
      code: "custom",
      message: "Visit event cannot occur before endedAt",
      path: ["occurredAt"],
    });
  }
}

export const visitStartedEventSchema = visitEventBaseSchema
  .extend({
    eventType: z.literal("VISIT_STARTED"),
    startedAt: utcDateTimeSchema,
    startSource: visitStartSourceSchema,
    startAccuracyMeters: z.number().finite().nonnegative().nullable(),
    measurementConfidence: measurementConfidenceSchema,
  })
  .refine((event) => Date.parse(event.occurredAt) >= Date.parse(event.startedAt), {
    message: "Visit start cannot occur before startedAt",
    path: ["occurredAt"],
  });

export const visitCompletedEventSchema = visitEventBaseSchema
  .extend({
    eventType: z.literal("VISIT_COMPLETED"),
    startedAt: utcDateTimeSchema,
    endedAt: utcDateTimeSchema,
    durationSeconds: z.number().int().nonnegative(),
    startSource: visitStartSourceSchema,
    endSource: visitCompletionSourceSchema,
    endAccuracyMeters: z.number().finite().nonnegative().nullable(),
    measurementConfidence: measurementConfidenceSchema,
  })
  .superRefine(validateEndedVisit);

export const visitExpiredEventSchema = visitEventBaseSchema
  .extend({
    eventType: z.literal("VISIT_EXPIRED"),
    startedAt: utcDateTimeSchema,
    endedAt: utcDateTimeSchema,
    durationSeconds: z.number().int().nonnegative(),
    startSource: visitStartSourceSchema,
    endSource: z.literal("MAX_DURATION"),
    measurementConfidence: measurementConfidenceSchema,
  })
  .superRefine(validateEndedVisit);

export const visitAbortedEventSchema = visitEventBaseSchema
  .extend({
    eventType: z.literal("VISIT_ABORTED"),
    startedAt: utcDateTimeSchema,
    endedAt: utcDateTimeSchema,
    durationSeconds: z.number().int().nonnegative(),
    startSource: visitStartSourceSchema,
    endSource: z.literal("CONSENT_REVOKED"),
    measurementConfidence: measurementConfidenceSchema,
  })
  .superRefine(validateEndedVisit);

export const visitEventSchema = z.discriminatedUnion("eventType", [
  visitStartedEventSchema,
  visitCompletedEventSchema,
  visitExpiredEventSchema,
  visitAbortedEventSchema,
]);

export type MeasurementConfidence = z.infer<typeof measurementConfidenceSchema>;
export type VisitStartSource = z.infer<typeof visitStartSourceSchema>;
export type VisitEndSource = z.infer<typeof visitEndSourceSchema>;
export type VisitEvent = z.infer<typeof visitEventSchema>;
export type VisitStartedEvent = z.infer<typeof visitStartedEventSchema>;
export type VisitCompletedEvent = z.infer<typeof visitCompletedEventSchema>;
export type VisitExpiredEvent = z.infer<typeof visitExpiredEventSchema>;
export type VisitAbortedEvent = z.infer<typeof visitAbortedEventSchema>;
