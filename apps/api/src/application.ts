import type { IncomingMessage } from "node:http";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import { EnvironmentService } from "./config/environment.js";
import { ApiExceptionFilter } from "./http/api-exception.filter.js";
import { resolveRequestId } from "./http/request-id.js";

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    genReqId: (request: IncomingMessage) => resolveRequestId(request.headers["x-request-id"]),
  });
}

export function configureApplication(
  app: NestFastifyApplication,
  corsOrigins: readonly string[] = ["http://localhost:3002"],
): void {
  app.setGlobalPrefix("v1");
  app.enableCors({
    origin: [...corsOrigins],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["content-type", "x-corri-public-application-key", "x-request-id"],
    exposedHeaders: ["x-request-id"],
    maxAge: 600,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
}

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter());
  const environment = app.get(EnvironmentService).values;
  configureApplication(app, environment.CORRI_CORS_ORIGINS);
  app.enableShutdownHooks();
  return app;
}
