import { z } from "zod";

import {
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

export const branchTypeSchema = z.enum([
  "BRANCH",
  "SERVICE_CENTER",
  "CAMPUS",
  "CLINIC",
  "OFFICE",
  "OTHER",
]);

export const coordinateQualitySchema = z.enum(["VERIFIED", "ESTIMATED", "MISSING"]);

export const branchSchema = z
  .object({
    id: branchIdSchema,
    tenantId: tenantIdSchema,
    externalBranchId: z.string().min(1).max(128),
    name: z.string().min(1).max(256),
    branchType: branchTypeSchema,
    addressLine1: z.string().min(1).max(256),
    addressLine2: z.string().max(256).nullable(),
    city: z.string().min(1).max(128),
    stateOrRegion: z.string().min(1).max(128),
    postalCode: z.string().max(32).nullable(),
    countryCode: countryCodeSchema,
    timeZone: timeZoneSchema,
    latitude: latitudeSchema.nullable(),
    longitude: longitudeSchema.nullable(),
    coordinateQuality: coordinateQualitySchema,
    approachRadiusMeters: radiusMetersSchema,
    visitRadiusMeters: radiusMetersSchema,
    exitRadiusMeters: radiusMetersSchema,
    active: z.boolean(),
    source: z.string().min(1).max(128),
    sourceVersion: z.string().min(1).max(128),
    verifiedAt: utcDateTimeSchema.nullable(),
    metadata: metadataSchema,
    createdAt: utcDateTimeSchema,
    updatedAt: utcDateTimeSchema,
  })
  .strict()
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

export type Branch = z.infer<typeof branchSchema>;
export type BranchType = z.infer<typeof branchTypeSchema>;
export type CoordinateQuality = z.infer<typeof coordinateQualitySchema>;
