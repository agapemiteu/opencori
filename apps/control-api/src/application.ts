import type { IncomingMessage } from "node:http";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";

import { AppModule } from "./app.module.js";
import { ApiExceptionFilter } from "./http/api-exception.filter.js";
import { resolveRequestId } from "./http/request-id.js";

export function createFastifyAdapter(): FastifyAdapter {
  return new FastifyAdapter({
    genReqId: (request: IncomingMessage) => resolveRequestId(request.headers["x-request-id"]),
  });
}

export function configureApplication(app: NestFastifyApplication): void {
  app.setGlobalPrefix("v1");
  app.useGlobalFilters(new ApiExceptionFilter());
}

export async function createApplication(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createFastifyAdapter());
  configureApplication(app);
  app.enableShutdownHooks();
  return app;
}
