import { z } from "zod";

import { branchTypeSchema, coordinateQualitySchema } from "./branch.js";
import { geofencePolicySchema } from "./configuration.js";
import {
  applicationIdSchema,
  branchIdSchema,
  countryCodeSchema,
  latitudeSchema,
  longitudeSchema,
  metadataSchema,
  radiusMetersSchema,
  tenantIdSchema,
  timeZoneSchema,
  utcDateTimeSchema,
} from "./primitives.js";

/**
 * Onboarding is the write half of the catalog: how an organisation registers
 * itself, its application, and the locations it wants watched.
 *
 * These schemas are deliberately more forgiving than the stored ones. A caller
 * supplies what only they can know, and the server fills in identifiers,
 * timestamps, and the geofence radii most locations never need to change.
 */

export const DEFAULT_APPROACH_RADIUS_METERS = 250;
export const DEFAULT_VISIT_RADIUS_METERS = 100;
export const DEFAULT_EXIT_RADIUS_METERS = 150;

export const createTenantRequestSchema = z
  .object({
    id: tenantIdSchema,
    name: z.string().min(1).max(256),
  })
  .strict();

/**
 * Registering an application.
 *
 * The configuration signing key is deliberately absent: OpenCori issues it, the
 * same way it issues the API key. Signing needs the private half, so a caller
 * supplying only a public key would leave OpenCori unable to sign anything as
 * that application — it would fall back to some other key and every response
 * would fail verification in the caller's own SDK.
 *
 * The generated public key comes back in the response. Pin that in the client.
 */
export const createApplicationRequestSchema = z
  .object({
    id: applicationIdSchema,
    name: z.string().min(1).max(256),
    publicApplicationKey: z.string().min(1).max(256),
    // The organisation's own receiver keypair. Only the public half is given,
    // because only the organisation should be able to decrypt what it receives.
    receiverEncryptionKeyId: z.string().min(1).max(128),
    receiverEncryptionPublicKey: z.string().min(1).max(4_096),
    // Omit to accept the defaults. This is where the visit timer lives:
    // maximumVisitDurationSeconds, the cooldowns, and the exit grace period.
    policy: geofencePolicySchema.optional(),
  })
  .strict();

export const updateApplicationPolicyRequestSchema = z
  .object({
    policy: geofencePolicySchema,
  })
  .strict();

/**
 * One location as an organisation supplies it.
 *
 * Only the fields nobody else can supply are required. Coordinate quality is
 * inferred from whether coordinates were given, and the three radii fall back
 * to the defaults above, so the smallest useful record is an id, an external
 * id, a name, an address, a city, a region, a country, and a time zone.
 */
export const branchInputSchema = z
  .object({
    id: branchIdSchema,
    externalBranchId: z.string().min(1).max(128),
    name: z.string().min(1).max(256),
    branchType: branchTypeSchema.default("BRANCH"),
    addressLine1: z.string().min(1).max(256),
    addressLine2: z.string().max(256).nullable().default(null),
    city: z.string().min(1).max(128),
    stateOrRegion: z.string().min(1).max(128),
    postalCode: z.string().max(32).nullable().default(null),
    countryCode: countryCodeSchema,
    timeZone: timeZoneSchema,
    latitude: latitudeSchema.nullable().default(null),
    longitude: longitudeSchema.nullable().default(null),
    coordinateQuality: coordinateQualitySchema.optional(),
    approachRadiusMeters: radiusMetersSchema.default(DEFAULT_APPROACH_RADIUS_METERS),
    visitRadiusMeters: radiusMetersSchema.default(DEFAULT_VISIT_RADIUS_METERS),
    exitRadiusMeters: radiusMetersSchema.default(DEFAULT_EXIT_RADIUS_METERS),
    active: z.boolean().default(true),
    source: z.string().min(1).max(128).default("onboarding-api"),
    sourceVersion: z.string().min(1).max(128).default("1"),
    verifiedAt: utcDateTimeSchema.nullable().default(null),
    metadata: metadataSchema.default({}),
  })
  .strict()
  .transform((branch) => ({
    ...branch,
    // A caller that gives coordinates without saying how good they are is
    // taken at its word but not upgraded to VERIFIED, which has to be claimed.
    coordinateQuality:
      branch.coordinateQuality ??
      (branch.latitude !== null && branch.longitude !== null
        ? ("ESTIMATED" as const)
        : ("MISSING" as const)),
  }))
  .superRefine((branch, context) => {
    const hasLatitude = branch.latitude !== null;
    const hasLongitude = branch.longitude !== null;

    if (hasLatitude !== hasLongitude) {
      context.addIssue({
        code: "custom",
        message: "Latitude and longitude must be provided together",
        path: ["latitude"],
      });
    }

    if (branch.coordinateQuality === "MISSING" && (hasLatitude || hasLongitude)) {
      context.addIssue({
        code: "custom",
        message: "Missing coordinates cannot include latitude or longitude",
        path: ["coordinateQuality"],
      });
    }

    if (branch.coordinateQuality !== "MISSING" && (!hasLatitude || !hasLongitude)) {
      context.addIssue({
        code: "custom",
        message: "Verified or estimated coordinates require latitude and longitude",
        path: ["coordinateQuality"],
      });
    }

    if (branch.exitRadiusMeters < branch.visitRadiusMeters) {
      context.addIssue({
        code: "custom",
        message: "Exit radius must be greater than or equal to visit radius",
        path: ["exitRadiusMeters"],
      });
    }

    if (branch.approachRadiusMeters < branch.exitRadiusMeters) {
      context.addIssue({
        code: "custom",
        message: "Approach radius must be greater than or equal to exit radius",
        path: ["approachRadiusMeters"],
      });
    }
  });

/**
 * Bulk upload. The cap is what one request should carry, not what a catalog may
 * hold: a bank with more locations than this pages through several calls.
 */
export const MAXIMUM_BRANCHES_PER_REQUEST = 500;

export const upsertBranchesRequestSchema = z
  .object({
    branches: z.array(branchInputSchema).min(1).max(MAXIMUM_BRANCHES_PER_REQUEST),
  })
  .strict()
  .superRefine((request, context) => {
    const seen = new Set<string>();
    for (const [index, branch] of request.branches.entries()) {
      if (seen.has(branch.id)) {
        context.addIssue({
          code: "custom",
          message: `Duplicate branch id "${branch.id}" in the same request`,
          path: ["branches", index, "id"],
        });
      }
      seen.add(branch.id);
    }
  });

/** Every field a location can change after it exists. */
export const updateBranchRequestSchema = z
  .object({
    name: z.string().min(1).max(256).optional(),
    active: z.boolean().optional(),
    approachRadiusMeters: radiusMetersSchema.optional(),
    visitRadiusMeters: radiusMetersSchema.optional(),
    exitRadiusMeters: radiusMetersSchema.optional(),
    metadata: metadataSchema.optional(),
  })
  .strict()
  .refine((update) => Object.keys(update).length > 0, {
    message: "An update must change at least one field",
  });

export const upsertBranchesResponseSchema = z
  .object({
    tenantId: tenantIdSchema,
    created: z.number().int().nonnegative(),
    updated: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  })
  .strict();

/**
 * The API key is returned once, when the tenant is created, and never again.
 * Only its hash is kept, so a lost key is reissued rather than recovered.
 */
export const createTenantResponseSchema = z
  .object({
    tenantId: tenantIdSchema,
    name: z.string().min(1).max(256),
    apiKey: z.string().min(1).max(256),
    createdAt: utcDateTimeSchema,
  })
  .strict();

export type CreateTenantRequest = z.infer<typeof createTenantRequestSchema>;
export type CreateTenantResponse = z.infer<typeof createTenantResponseSchema>;
export type CreateApplicationRequest = z.infer<typeof createApplicationRequestSchema>;
export type UpdateApplicationPolicyRequest = z.infer<typeof updateApplicationPolicyRequestSchema>;
export type BranchInput = z.infer<typeof branchInputSchema>;
export type UpsertBranchesRequest = z.infer<typeof upsertBranchesRequestSchema>;
export type UpsertBranchesResponse = z.infer<typeof upsertBranchesResponseSchema>;
export type UpdateBranchRequest = z.infer<typeof updateBranchRequestSchema>;
