import { randomUUID } from "node:crypto";

import { z } from "zod";

const requestIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9._:-]+$/);

export function resolveRequestId(header: unknown): string {
  const result = requestIdSchema.safeParse(header);
  return result.success ? result.data : randomUUID();
}
