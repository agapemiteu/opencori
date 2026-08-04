import { z } from "zod";

import { branchSchema } from "./branch.js";
import {
  applicationIdSchema,
  ed25519SignatureSchema,
  latitudeSchema,
  longitudeSchema,
  tenantIdSchema,
  utcDateTimeSchema,
} from "./primitives.js";

export const nearbyBranchesQuerySchema = z
  .object({
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    lat: z.coerce.number().pipe(latitudeSchema),
    lng: z.coerce.number().pipe(longitudeSchema),
    radiusKm: z.coerce.number().finite().positive().max(500),
    limit: z.coerce.number().int().positive().max(20).default(20),
  })
  .strict();

export const nearbyBranchSchema = z
  .object({
    branch: branchSchema,
    distanceMeters: z.number().int().nonnegative(),
  })
  .strict();

export const nearbyBranchesPayloadSchema = z
  .object({
    tenantId: tenantIdSchema,
    applicationId: applicationIdSchema,
    configurationVersion: z.string().min(1).max(128),
    generatedAt: utcDateTimeSchema,
    query: z
      .object({
        latitude: latitudeSchema,
        longitude: longitudeSchema,
        radiusKm: z.number().finite().positive().max(500),
        limit: z.number().int().positive().max(20),
      })
      .strict(),
    branches: z.array(nearbyBranchSchema).max(20),
  })
  .strict();

export const signedNearbyBranchesResponseSchema = z
  .object({
    algorithm: z.literal("Ed25519"),
    keyId: z.string().min(1).max(128),
    payload: nearbyBranchesPayloadSchema,
    signature: ed25519SignatureSchema,
  })
  .strict();

export type NearbyBranchesQuery = z.infer<typeof nearbyBranchesQuerySchema>;
export type NearbyBranch = z.infer<typeof nearbyBranchSchema>;
export type NearbyBranchesPayload = z.infer<typeof nearbyBranchesPayloadSchema>;
export type SignedNearbyBranchesResponse = z.infer<typeof signedNearbyBranchesResponseSchema>;
