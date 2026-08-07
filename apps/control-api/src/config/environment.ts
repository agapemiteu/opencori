import { Injectable } from "@nestjs/common";
import { z } from "zod";

const environmentSchema = z.object({
  CORRI_HOST: z.string().min(1).default("0.0.0.0"),
  CORRI_PORT: z.coerce.number().int().min(1).max(65_535).default(3_000),
  CORRI_SERVICE_VERSION: z.string().min(1).max(128).default("0.0.0"),
  CORRI_CORS_ORIGINS: z
    .string()
    .default("http://localhost:3002")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().url()).min(1).max(10)),
  WEMA_DEMO_WEBHOOK_URL: z.string().url().default("http://127.0.0.1:3001/v1/wema/deliveries"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Environment = z.infer<typeof environmentSchema>;

export function parseEnvironment(source: NodeJS.ProcessEnv): Environment {
  return environmentSchema.parse(source);
}

@Injectable()
export class EnvironmentService {
  readonly values = parseEnvironment(process.env);
}
