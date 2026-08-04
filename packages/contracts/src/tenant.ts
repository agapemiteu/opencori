import { z } from "zod";

import { branchSchema } from "./branch.js";
import { applicationIdSchema, tenantIdSchema, utcDateTimeSchema } from "./primitives.js";

export const tenantSchema = z
  .object({
    id: tenantIdSchema,
    name: z.string().min(1).max(256),
    demo: z.boolean(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();

export const applicationSchema = z
  .object({
    id: applicationIdSchema,
    tenantId: tenantIdSchema,
    name: z.string().min(1).max(256),
    publicApplicationKey: z.string().min(1).max(256),
    configurationSigningKeyId: z.string().min(1).max(128),
    configurationSigningPublicKey: z.string().min(1).max(1_024),
    receiverEncryptionKeyId: z.string().min(1).max(128),
    receiverEncryptionPublicKey: z.string().min(1).max(4_096),
    active: z.boolean(),
    demo: z.boolean(),
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict();

export const demoCatalogResponseSchema = z
  .object({
    tenant: tenantSchema,
    application: applicationSchema,
    branchCount: z.number().int().nonnegative(),
    sourceSummary: z.string().min(1).max(1_024),
  })
  .strict();

export const demoBranchesResponseSchema = z
  .object({
    tenantId: tenantIdSchema,
    demo: z.literal(true),
    branches: z.array(branchSchema),
  })
  .strict();

export type Tenant = z.infer<typeof tenantSchema>;
export type Application = z.infer<typeof applicationSchema>;
export type DemoCatalogResponse = z.infer<typeof demoCatalogResponseSchema>;
export type DemoBranchesResponse = z.infer<typeof demoBranchesResponseSchema>;
