import { z } from "zod";

import { utcDateTimeSchema } from "./primitives.js";

export const apiErrorCodeSchema = z.enum([
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "EXPIRED",
  "REPLAY_REJECTED",
  "METHOD_NOT_ALLOWED",
  "REQUEST_TIMEOUT",
  "PAYLOAD_TOO_LARGE",
  "UNSUPPORTED_MEDIA_TYPE",
  "RATE_LIMITED",
  "DEPENDENCY_UNAVAILABLE",
  "INTERNAL_ERROR",
]);

export const apiErrorSchema = z
  .object({
    error: z
      .object({
        code: apiErrorCodeSchema,
        message: z.string().min(1).max(512),
        requestId: z.string().min(1).max(128),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .strict(),
  })
  .strict();

export const healthResponseSchema = z
  .object({
    status: z.literal("ok"),
    service: z.literal("corri-control-api"),
    version: z.string().min(1),
    timestamp: utcDateTimeSchema,
  })
  .strict();

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
