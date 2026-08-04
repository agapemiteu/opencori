import { z } from "zod";

import {
  applicationIdSchema,
  eventIdSchema,
  tenantIdSchema,
  visitTokenSchema,
} from "./primitives.js";

export const visitEventIngestionReceiptSchema = z
  .object({
    eventId: eventIdSchema,
    tenantId: tenantIdSchema,
    visitToken: visitTokenSchema,
    status: z.enum(["RECORDED", "DUPLICATE"]),
  })
  .strict();

export const demoAnalyticsResponseSchema = z
  .object({
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    demo: z.literal(true),
    confirmedVisits: z.number().int().nonnegative(),
    activeVisits: z.number().int().nonnegative(),
    completedVisits: z.number().int().nonnegative(),
    medianBranchPresenceDurationSeconds: z.number().int().nonnegative().nullable(),
    p90BranchPresenceDurationSeconds: z.number().int().nonnegative().nullable(),
    deliveredRequests: z.number().int().nonnegative(),
    medianDeliveryLatencyMilliseconds: z.number().int().nonnegative().nullable(),
  })
  .strict();

export const privacyProofResponseSchema = z
  .object({
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    demo: z.literal(true),
    readableRequestContentStored: z.literal(false),
    bankingDataStored: z.literal(false),
    inspectedVisitEventCount: z.number().int().nonnegative(),
    inspectedDeliveryCount: z.number().int().nonnegative(),
    retainedEncryptedPayloadCount: z.number().int().nonnegative(),
    storedFieldCategories: z.array(z.string().min(1).max(128)).min(1),
    prohibitedFieldCategories: z.array(z.string().min(1).max(128)).min(1),
  })
  .strict();

export type VisitEventIngestionReceipt = z.infer<typeof visitEventIngestionReceiptSchema>;
export type DemoAnalyticsResponse = z.infer<typeof demoAnalyticsResponseSchema>;
export type PrivacyProofResponse = z.infer<typeof privacyProofResponseSchema>;
