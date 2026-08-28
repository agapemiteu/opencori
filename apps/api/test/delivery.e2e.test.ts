import {
  deliveryReceiptSchema,
  demoAnalyticsResponseSchema,
  demoCatalogResponseSchema,
  privacyProofResponseSchema,
  type SignedDeliveryAttempt,
} from "@opencori/contracts";
import { encryptRequest } from "@opencori/crypto-envelope";
import {
  CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
  CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
  WEMA_DEMO_ENCRYPTION_KEY_ID,
  WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
} from "@opencori/mock-receiver/demo-keys";
import { ReceiverService, type ReceiverSettings } from "@opencori/mock-receiver/receiver-service";
import { Test } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { afterEach, describe, expect, it } from "vitest";

import { AppModule } from "../src/app.module.js";
import { configureApplication, createFastifyAdapter } from "../src/application.js";
import {
  DELIVERY_DESTINATION,
  type DeliveryDestination,
} from "../src/delivery/delivery-destination.js";
import { CLOCK, type Clock } from "../src/platform/clock.js";

const acceptedAt = new Date("2026-08-03T12:00:00.000Z");
const receivedAt = new Date("2026-08-03T12:00:00.244Z");
const clock: Clock = { now: () => acceptedAt };
const receiverSettings: ReceiverSettings = {
  expectedTenantId: "wema",
  expectedApplicationId: "alat-demo",
  expectedDestinationId: "wema_mock_receiver",
  webhookSigningKeyId: CORRI_DEMO_WEBHOOK_SIGNING_KEY_ID,
  webhookSigningPublicKey: CORRI_DEMO_WEBHOOK_SIGNING_PUBLIC_KEY,
  encryptionKeyId: WEMA_DEMO_ENCRYPTION_KEY_ID,
  encryptionPrivateKey: WEMA_DEMO_ENCRYPTION_PRIVATE_KEY,
  now: () => receivedAt,
};

describe("encrypted delivery gateway", () => {
  let app: NestFastifyApplication | undefined;

  afterEach(async () => {
    await app?.close();
  });

  it("relays opaque ciphertext to Wema, returns a receipt, and deletes ciphertext after success", async () => {
    const receiver = new ReceiverService(receiverSettings);
    let destinationCalls = 0;
    const destination: DeliveryDestination = {
      deliver: async (attempt: SignedDeliveryAttempt) => {
        destinationCalls += 1;
        await Promise.resolve();
        return receiver.receive(attempt);
      },
    };
    const moduleReference = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CLOCK)
      .useValue(clock)
      .overrideProvider(DELIVERY_DESTINATION)
      .useValue(destination)
      .compile();
    app = moduleReference.createNestApplication<NestFastifyApplication>(createFastifyAdapter(), {
      logger: false,
    });
    configureApplication(app);
    await app.init();
    await app.getHttpAdapter().getInstance().ready();

    const catalogResponse = await app.inject({ method: "GET", url: "/v1/catalog" });
    const catalog = demoCatalogResponseSchema.parse(catalogResponse.json());
    const started = {
      eventId: "visit_started_delivery_01",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_delivery_01",
      branchId: "wema_marina",
      visitToken: "visit_delivery_01",
      occurredAt: acceptedAt.toISOString(),
      configurationVersion: "wema-alat-demo-2026-08-03.1",
      demo: true,
      eventType: "VISIT_STARTED",
      startedAt: acceptedAt.toISOString(),
      startSource: "CUSTOMER_CONFIRMED",
      startAccuracyMeters: null,
      measurementConfidence: "HIGH",
    };
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/v1/sdk/visits/events",
          payload: started,
        })
      ).statusCode,
    ).toBe(201);
    const customerMessage = "Please help with a transfer made from ALAT today.";
    const encrypted = encryptRequest(
      customerMessage,
      catalog.application.receiverEncryptionPublicKey,
      catalog.application.receiverEncryptionKeyId,
    );
    const envelope = {
      eventId: "delivery_01",
      tenantId: "wema",
      applicationId: "alat-demo",
      anonymousInstallationId: "inst_delivery_01",
      visitToken: "visit_delivery_01",
      branchId: "wema_marina",
      routeKey: "customer-care.general",
      ...encrypted,
      createdAt: acceptedAt.toISOString(),
      expiresAt: "2026-08-04T12:00:00.000Z",
    };
    expect(JSON.stringify(envelope)).not.toContain(customerMessage);

    const wrongBranch = await app.inject({
      method: "POST",
      url: "/v1/sdk/deliveries",
      payload: { ...envelope, eventId: "delivery_wrong_branch", branchId: "wema_aba" },
    });
    const wrongInstallation = await app.inject({
      method: "POST",
      url: "/v1/sdk/deliveries",
      payload: {
        ...envelope,
        eventId: "delivery_wrong_installation",
        anonymousInstallationId: "inst_delivery_02",
      },
    });
    expect(wrongBranch.statusCode).toBe(404);
    expect(wrongInstallation.statusCode).toBe(404);

    const [response, duplicate] = await Promise.all([
      app.inject({ method: "POST", url: "/v1/sdk/deliveries", payload: envelope }),
      app.inject({ method: "POST", url: "/v1/sdk/deliveries", payload: envelope }),
    ]);
    const changedReplay = await app.inject({
      method: "POST",
      url: "/v1/sdk/deliveries",
      payload: { ...envelope, expiresAt: "2026-08-04T12:01:00.000Z" },
    });
    const receiptResponse = await app.inject({
      method: "GET",
      url: "/v1/sdk/deliveries/delivery_01?tenantId=wema",
    });
    const analyticsResponse = await app.inject({ method: "GET", url: "/v1/analytics" });
    const privacyResponse = await app.inject({ method: "GET", url: "/v1/privacy" });

    expect(deliveryReceiptSchema.parse(response.json())).toMatchObject({
      state: "DELIVERED",
      attemptCount: 1,
      latencyMilliseconds: 244,
    });
    expect(deliveryReceiptSchema.parse(duplicate.json())).toEqual(
      deliveryReceiptSchema.parse(response.json()),
    );
    expect(changedReplay.statusCode).toBe(409);
    expect(destinationCalls).toBe(1);
    expect(deliveryReceiptSchema.parse(receiptResponse.json())).toEqual(
      deliveryReceiptSchema.parse(response.json()),
    );
    expect(receiver.listMessages()).toEqual([
      expect.objectContaining({ eventId: "delivery_01", message: customerMessage }),
    ]);
    expect(demoAnalyticsResponseSchema.parse(analyticsResponse.json())).toMatchObject({
      deliveredRequests: 1,
      medianDeliveryLatencyMilliseconds: 244,
    });
    const privacy = privacyProofResponseSchema.parse(privacyResponse.json());
    expect(privacy).toMatchObject({
      readableRequestContentStored: false,
      bankingDataStored: false,
      inspectedDeliveryCount: 1,
      retainedEncryptedPayloadCount: 0,
    });
    expect(privacyResponse.body).not.toContain(customerMessage);
    expect(privacyResponse.body).not.toContain(encrypted.encryptedPayload.ciphertext);

    const completed = {
      eventId: "visit_completed_delivery_01",
      tenantId: started.tenantId,
      applicationId: started.applicationId,
      anonymousInstallationId: started.anonymousInstallationId,
      branchId: started.branchId,
      visitToken: started.visitToken,
      occurredAt: "2026-08-03T12:01:00.000Z",
      configurationVersion: started.configurationVersion,
      demo: true,
      eventType: "VISIT_COMPLETED",
      startedAt: started.startedAt,
      endedAt: "2026-08-03T12:01:00.000Z",
      durationSeconds: 60,
      startSource: started.startSource,
      endSource: "MANUAL_EXIT",
      endAccuracyMeters: null,
      measurementConfidence: "HIGH",
    };
    expect(
      (await app.inject({ method: "POST", url: "/v1/sdk/visits/events", payload: completed }))
        .statusCode,
    ).toBe(201);
    const afterVisit = await app.inject({
      method: "POST",
      url: "/v1/sdk/deliveries",
      payload: { ...envelope, eventId: "delivery_after_visit" },
    });
    expect(afterVisit.statusCode).toBe(404);
  });
});
