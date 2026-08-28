import {
  CATALOG_REPOSITORY,
  InMemoryCatalogRepository,
} from "../src/catalog/catalog.repository.js";
import { apiErrorSchema, healthResponseSchema } from "@opencori/contracts";
import { Controller, Get, HttpException, HttpStatus } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import {
  configureApplication,
  createApplication,
  createFastifyAdapter,
} from "../src/application.js";
import { CLOCK, type Clock } from "../src/platform/clock.js";

const fixedNow = new Date("2026-08-03T12:00:00.000Z");
const fixedClock: Clock = {
  now: () => fixedNow,
};

@Controller("_test/failure")
class FailureController {
  @Get()
  fail(): never {
    throw new Error("Sensitive internal detail");
  }
}

@Controller("_test/payload-too-large")
class PayloadTooLargeController {
  @Get()
  fail(): never {
    throw new HttpException("Sensitive transport detail", HttpStatus.PAYLOAD_TOO_LARGE);
  }
}

describe("control API", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createTestApplication(): Promise<NestFastifyApplication> {
    const moduleReference = await Test.createTestingModule({
      controllers: [FailureController, PayloadTooLargeController],
      imports: [AppModule],
    })
      .overrideProvider(CATALOG_REPOSITORY)
      .useValue(new InMemoryCatalogRepository())
      .overrideProvider(CLOCK)
      .useValue(fixedClock)
      .compile();

    app = moduleReference.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
      logger: false,
    });
    configureApplication(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
  }

  it("returns a contract-valid health response", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/health",
    });

    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.parse(response.json())).toEqual({
      status: "ok",
      service: "corri-control-api",
      version: "0.0.0",
      timestamp: fixedNow.toISOString(),
    });
  });

  it("allows the configured ALAT demo origin and does not reflect other origins", async () => {
    const testApp = await createTestApplication();
    const allowed = await testApp.inject({
      method: "OPTIONS",
      url: "/v1/health",
      headers: {
        origin: "http://localhost:3002",
        "access-control-request-method": "GET",
      },
    });
    const untrusted = await testApp.inject({
      method: "OPTIONS",
      url: "/v1/health",
      headers: {
        origin: "https://untrusted.example",
        "access-control-request-method": "GET",
      },
    });

    expect(allowed.statusCode).toBe(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe("http://localhost:3002");
    expect(untrusted.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns a stable error envelope and preserves a valid request ID", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/missing",
      headers: { "x-request-id": "request_test_001" },
    });

    expect(response.statusCode).toBe(404);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
        requestId: "request_test_001",
      },
    });
  });

  it("does not reflect an invalid request ID", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/missing",
      headers: { "x-request-id": "invalid request id" },
    });
    const body = apiErrorSchema.parse(response.json());

    expect(body.error.requestId).not.toBe("invalid request id");
    expect(body.error.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("sanitizes unexpected server errors", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/_test/failure",
      headers: { "x-request-id": "request_failure_001" },
    });

    expect(response.statusCode).toBe(500);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "Internal server error",
        requestId: "request_failure_001",
      },
    });
    expect(response.body).not.toContain("Sensitive internal detail");
  });

  it("maps supported client failures without exposing exception details", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/_test/payload-too-large",
      headers: { "x-request-id": "request_payload_001" },
    });

    expect(response.statusCode).toBe(413);
    expect(apiErrorSchema.parse(response.json())).toEqual({
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "Request payload too large",
        requestId: "request_payload_001",
      },
    });
    expect(response.body).not.toContain("Sensitive transport detail");
  });

  it("creates the production application graph", async () => {
    app = await createApplication();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const response = await app.inject({ method: "GET", url: "/v1/health" });
    expect(response.statusCode).toBe(200);
    expect(healthResponseSchema.safeParse(response.json()).success).toBe(true);
  });
});
