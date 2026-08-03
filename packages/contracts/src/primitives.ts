import { z } from "zod";

const identifier = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]*$/);

export const tenantIdSchema = identifier.brand<"TenantId">();
export const applicationIdSchema = identifier.brand<"ApplicationId">();
export const installationIdSchema = identifier.brand<"InstallationId">();
export const branchIdSchema = identifier.brand<"BranchId">();
export const visitTokenSchema = identifier.brand<"VisitToken">();
export const eventIdSchema = identifier.brand<"EventId">();
export const routeKeySchema = identifier.brand<"RouteKey">();
export const correlationIdSchema = identifier.brand<"CorrelationId">();

export const utcDateTimeSchema = z
  .string()
  .datetime({ offset: true })
  .refine((value) => value.endsWith("Z"), { message: "Expected a UTC date-time" });
export const countryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const timeZoneSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (value) => {
      try {
        Intl.DateTimeFormat("en", { timeZone: value });
        return true;
      } catch {
        return false;
      }
    },
    { message: "Expected an IANA time zone" },
  );

export const latitudeSchema = z.number().finite().min(-90).max(90);
export const longitudeSchema = z.number().finite().min(-180).max(180);
export const radiusMetersSchema = z.number().int().positive().max(100_000);
export const metadataSchema = z
  .record(
    z.string().min(1).max(64),
    z.union([z.string().max(1_024), z.number().finite(), z.boolean(), z.null()]),
  )
  .refine((metadata) => Object.keys(metadata).length <= 50, {
    message: "Metadata cannot contain more than 50 entries",
  });
export const ed25519SignatureSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{86}(?:==)?$/, "Expected a 64-byte base64url Ed25519 signature");

export type TenantId = z.infer<typeof tenantIdSchema>;
export type ApplicationId = z.infer<typeof applicationIdSchema>;
export type InstallationId = z.infer<typeof installationIdSchema>;
export type BranchId = z.infer<typeof branchIdSchema>;
export type VisitToken = z.infer<typeof visitTokenSchema>;
export type EventId = z.infer<typeof eventIdSchema>;
export type RouteKey = z.infer<typeof routeKeySchema>;
export type CorrelationId = z.infer<typeof correlationIdSchema>;
