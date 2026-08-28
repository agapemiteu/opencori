import {
  apiErrorSchema,
  demoBranchesResponseSchema,
  demoAnalyticsResponseSchema,
  demoCatalogResponseSchema,
  privacyProofResponseSchema,
  signedConfigurationSchema,
  signedNearbyBranchesResponseSchema,
  visitEventIngestionReceiptSchema,
} from "@opencori/contracts";
import { verifySignedPayload } from "@opencori/config-verifier";
import { Test } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { configureApplication, createFastifyAdapter } from "../src/application.js";
import { CLOCK, type Clock } from "../src/platform/clock.js";

const fixedNow = new Date("2026-08-03T12:00:00.000Z");
const fixedClock: Clock = { now: () => fixedNow };

describe("Wema ALAT demo configuration", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  async function createTestApplication(): Promise<NestFastifyApplication> {
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
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

  it("exposes the demo tenant, ALAT application, and ten provenance-labelled branches", async () => {
    const testApp = await createTestApplication();
    const catalogResponse = await testApp.inject({ method: "GET", url: "/v1/catalog" });
    const catalog = demoCatalogResponseSchema.parse(catalogResponse.json());
    const branchesResponse = await testApp.inject({ method: "GET", url: "/v1/branches" });
    const registry = demoBranchesResponseSchema.parse(branchesResponse.json());

    expect(catalogResponse.statusCode).toBe(200);
    expect(catalog).toMatchObject({
      tenant: { id: "wema", name: "Wema Bank", demo: true },
      application: { id: "alat-demo", tenantId: "wema", demo: true },
      branchCount: 10,
    });
    expect(registry.branches).toHaveLength(10);
    expect(new Set(registry.branches.map((branch) => branch.stateOrRegion)).size).toBe(10);
    expect(registry.branches.every((branch) => branch.metadata.productionEligible === false)).toBe(
      true,
    );
    expect(
      registry.branches.filter((branch) => branch.coordinateQuality === "ESTIMATED"),
    ).toHaveLength(1);
    expect(
      registry.branches.filter((branch) => branch.coordinateQuality === "MISSING"),
    ).toHaveLength(9);
  });

  it("publishes an Ed25519-signed configuration verifiable by the seeded application key", async () => {
    const testApp = await createTestApplication();
    const catalogResponse = await testApp.inject({ method: "GET", url: "/v1/catalog" });
    const catalog = demoCatalogResponseSchema.parse(catalogResponse.json());
    const response = await testApp.inject({
      method: "POST",
      url: "/v1/configurations/publish",
      payload: { tenantId: "wema", applicationId: "alat-demo" },
    });
    const signed = signedConfigurationSchema.parse(response.json());

    expect(response.statusCode).toBe(201);
    expect(signed.payload.publishedAt).toBe(fixedNow.toISOString());
    expect(
      verifySignedPayload(signed, {
        keyId: catalog.application.configurationSigningKeyId,
        publicKeyPem: catalog.application.configurationSigningPublicKey,
      }),
    ).toBe(true);
  });

  it("serves the published configuration to the SDK with the same verifiable contract", async () => {
    const testApp = await createTestApplication();
    const catalogResponse = await testApp.inject({ method: "GET", url: "/v1/catalog" });
    const catalog = demoCatalogResponseSchema.parse(catalogResponse.json());
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/sdk/configuration?tenantId=wema&applicationId=alat-demo",
    });
    const signed = signedConfigurationSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(
      verifySignedPayload(signed, {
        keyId: catalog.application.configurationSigningKeyId,
        publicKeyPem: catalog.application.configurationSigningPublicKey,
      }),
    ).toBe(true);
  });

  it("returns a signed nearby subset and excludes records without coordinates", async () => {
    const testApp = await createTestApplication();
    const catalogResponse = await testApp.inject({ method: "GET", url: "/v1/catalog" });
    const catalog = demoCatalogResponseSchema.parse(catalogResponse.json());
    const response = await testApp.inject({
      method: "GET",
      url: "/v1/sdk/branches/nearby?tenantId=wema&applicationId=alat-demo&lat=6.45&lng=3.395&radiusKm=50",
    });
    const signed = signedNearbyBranchesResponseSchema.parse(response.json());

    expect(response.statusCode).toBe(200);
    expect(signed.payload.branches).toHaveLength(1);
    expect(signed.payload.branches[0]?.branch.id).toBe("wema_marina");
    expect(signed.payload.branches[0]?.distanceMeters).toBe(0);
    expect(
      verifySignedPayload(signed, {
        keyId: catalog.application.configurationSigningKeyId,
        publicKeyPem: catalog.application.configurationSigningPublicKey,
      }),
    ).toBe(true);
  });

  it("rejects invalid nearby queries and unknown tenant/application combinations", async () => {
    const testApp = await createTestApplication();
    const invalid = await testApp.inject({
      method: "GET",
      url: "/v1/sdk/branches/nearby?tenantId=wema&applicationId=alat-demo&lat=91&lng=3&radiusKm=50",
      headers: { "x-request-id": "request_invalid_nearby" },
    });
    const missing = await testApp.inject({
      method: "GET",
      url: "/v1/sdk/branches/nearby?tenantId=other&applicationId=alat-demo&lat=6.45&lng=3.395&radiusKm=50",
      headers: { "x-request-id": "request_unknown_tenant" },
    });

    expect(invalid.statusCode).toBe(400);
    expect(apiErrorSchema.parse(invalid.json()).error.code).toBe("VALIDATION_FAILED");
    expect(missing.statusCode).toBe(404);
    expect(apiErrorSchema.parse(missing.json()).error.code).toBe("NOT_FOUND");
  });

  it("records an idempotent confirmed visit and returns duration analytics and privacy proof", async () => {
    const testApp = await createTestApplication();
    const started = {
      eventId: "evt_visit_started_01",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_demo_01",
      branchId: "wema_marina",
      visitToken: "visit_01",
      occurredAt: "2026-08-03T10:00:00.000Z",
      configurationVersion: "wema-alat-demo-2026-08-03.1",
      demo: true,
      eventType: "VISIT_STARTED",
      startedAt: "2026-08-03T10:00:00.000Z",
      startSource: "CUSTOMER_CONFIRMED",
      startAccuracyMeters: null,
      measurementConfidence: "HIGH",
    } as const;
    const completed = {
      eventId: "evt_visit_completed_01",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_demo_01",
      branchId: "wema_marina",
      visitToken: "visit_01",
      occurredAt: "2026-08-03T10:01:35.000Z",
      configurationVersion: "wema-alat-demo-2026-08-03.1",
      demo: true,
      eventType: "VISIT_COMPLETED",
      startedAt: "2026-08-03T10:00:00.000Z",
      endedAt: "2026-08-03T10:01:35.000Z",
      durationSeconds: 95,
      startSource: "CUSTOMER_CONFIRMED",
      endSource: "GEOFENCE_EXIT",
      endAccuracyMeters: null,
      measurementConfidence: "HIGH",
    } as const;

    const startResponse = await testApp.inject({
      method: "POST",
      url: "/v1/sdk/visits/events",
      payload: started,
    });
    const duplicateResponse = await testApp.inject({
      method: "POST",
      url: "/v1/sdk/visits/events",
      payload: started,
    });
    const completionResponse = await testApp.inject({
      method: "POST",
      url: "/v1/sdk/visits/events",
      payload: completed,
    });
    const analyticsResponse = await testApp.inject({
      method: "GET",
      url: "/v1/analytics",
    });
    const privacyResponse = await testApp.inject({ method: "GET", url: "/v1/privacy" });

    expect(visitEventIngestionReceiptSchema.parse(startResponse.json()).status).toBe("RECORDED");
    expect(visitEventIngestionReceiptSchema.parse(duplicateResponse.json()).status).toBe(
      "DUPLICATE",
    );
    expect(visitEventIngestionReceiptSchema.parse(completionResponse.json()).status).toBe(
      "RECORDED",
    );
    expect(demoAnalyticsResponseSchema.parse(analyticsResponse.json())).toMatchObject({
      confirmedVisits: 1,
      activeVisits: 0,
      completedVisits: 1,
      medianBranchPresenceDurationSeconds: 95,
      p90BranchPresenceDurationSeconds: 95,
    });
    expect(privacyProofResponseSchema.parse(privacyResponse.json())).toMatchObject({
      readableRequestContentStored: false,
      bankingDataStored: false,
      inspectedVisitEventCount: 2,
      inspectedDeliveryCount: 0,
    });
    expect(privacyResponse.body).not.toContain("complaintText");
    expect(privacyResponse.body).not.toContain("accountNumber");
  });

  it("rejects a visit completion that has no matching start event", async () => {
    const testApp = await createTestApplication();
    const response = await testApp.inject({
      method: "POST",
      url: "/v1/sdk/visits/events",
      payload: {
        eventId: "evt_orphan_completion",
        tenantId: "wema",
        applicationId: "alat-demo",
        anonymousInstallationId: "inst_demo_01",
        branchId: "wema_marina",
        visitToken: "visit_orphan",
        occurredAt: "2026-08-03T10:01:35.000Z",
        configurationVersion: "wema-alat-demo-2026-08-03.1",
        demo: true,
        eventType: "VISIT_COMPLETED",
        startedAt: "2026-08-03T10:00:00.000Z",
        endedAt: "2026-08-03T10:01:35.000Z",
        durationSeconds: 95,
        startSource: "CUSTOMER_CONFIRMED",
        endSource: "GEOFENCE_EXIT",
        endAccuracyMeters: null,
        measurementConfidence: "HIGH",
      },
      headers: { "x-request-id": "request_orphan_visit" },
    });

    expect(response.statusCode).toBe(409);
    expect(apiErrorSchema.parse(response.json()).error.code).toBe("CONFLICT");
  });
});
